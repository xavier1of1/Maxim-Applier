import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

import { fromRoot } from "./path-utils.mjs";

const PY_XLSX_READER = String.raw`
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

path = sys.argv[1]
ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

def text_of(cell, shared_strings):
    value = cell.find("a:v", ns)
    if value is None:
        inline = cell.find("a:is/a:t", ns)
        return inline.text if inline is not None and inline.text is not None else ""
    text = value.text or ""
    if cell.attrib.get("t") == "s":
        try:
            return shared_strings[int(text)]
        except (ValueError, IndexError):
            return ""
    return text

def col_index(ref):
    letters = re.sub(r"[^A-Z]", "", ref.upper())
    total = 0
    for ch in letters:
        total = total * 26 + (ord(ch) - ord("A") + 1)
    return total - 1

with zipfile.ZipFile(path) as zf:
    shared_strings = []
    if "xl/sharedStrings.xml" in zf.namelist():
        root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
        for item in root.findall("a:si", ns):
            shared_strings.append("".join(node.text or "" for node in item.findall(".//a:t", ns)))

    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    first_sheet = workbook.find("a:sheets/a:sheet", ns)
    if first_sheet is None:
        print(json.dumps([]))
        sys.exit(0)
    rel_id = first_sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]

    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_ns = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
    target = None
    for rel in rels.findall("r:Relationship", rel_ns):
        if rel.attrib.get("Id") == rel_id:
            target = rel.attrib["Target"].lstrip("/")
            break
    if target is None:
        raise ValueError("Could not resolve first worksheet relationship")
    sheet_path = target if target.startswith("xl/") else "xl/" + target

    sheet = ET.fromstring(zf.read(sheet_path))
    rows = []
    for row in sheet.findall(".//a:sheetData/a:row", ns):
        cells = []
        for cell in row.findall("a:c", ns):
            ref = cell.attrib.get("r", "")
            idx = col_index(ref) if ref else len(cells)
            while len(cells) <= idx:
                cells.append("")
            cells[idx] = text_of(cell, shared_strings)
        rows.append(cells)
    print(json.dumps(rows))
`;

function stableId(prefix, value) {
  return `${prefix}_${crypto.createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseHistoryCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const raw = Object.fromEntries(header.map((key, cellIndex) => [key, cells[cellIndex] ?? ""]));
    const interviewRound = raw["Interview Round"] ?? raw.interview_round ?? "";
    const rawStatus = raw["Application Status"] ?? raw.Status ?? "";
    const interviewSignal = interviewRound.trim().length > 0;
    return {
      rowNumber: index + 2,
      raw,
      normalized: {
        company: raw.Company ?? raw.company ?? "",
        role: raw.Role ?? raw.Title ?? raw.role ?? "",
        source: raw.Source ?? raw.source ?? "",
        link: raw.Link ?? raw.URL ?? raw.link ?? "",
        salary: raw.Salary ?? raw.salary ?? "",
        dateSubmitted: raw["Date Submitted"] ?? raw.Date ?? "",
        interviewRound,
        applicationStatusRaw: rawStatus,
        interviewSignal,
        normalizedOutcome: interviewSignal ? "interview_signal" : "submitted_or_unknown",
        issues: [],
      },
    };
  });
}

function rowsFromTable(table) {
  const meaningfulRows = table.filter((row) => row.some((cell) => String(cell ?? "").trim().length > 0));
  if (meaningfulRows.length === 0) {
    return [];
  }
  const header = meaningfulRows[0].map((cell) => String(cell ?? "").trim());
  return meaningfulRows.slice(1).map((cells, index) => {
    const raw = Object.fromEntries(header.map((key, cellIndex) => [key, String(cells[cellIndex] ?? "").trim()]));
    return normalizeHistoryRow(raw, index + 2);
  });
}

function normalizeHistoryRow(raw, rowNumber) {
  const interviewRound = raw["Interview Round"] ?? raw.interview_round ?? "";
  const rawStatus = raw["Application Status"] ?? raw.Status ?? "";
  const interviewSignal = interviewRound.trim().length > 0;
  return {
    rowNumber,
    raw,
    normalized: {
      company: raw.Company ?? raw.company ?? "",
      role: raw.Role ?? raw.Title ?? raw.role ?? "",
      source: raw.Source ?? raw.source ?? "",
      link: raw.Link ?? raw.URL ?? raw.link ?? "",
      salary: raw.Salary ?? raw.salary ?? "",
      dateSubmitted: raw["Date Submitted"] ?? raw.Date ?? "",
      interviewRound,
      applicationStatusRaw: rawStatus,
      interviewSignal,
      normalizedOutcome: interviewSignal ? "interview_signal" : "submitted_or_unknown",
      issues: [],
    },
  };
}

export function parseHistoryXlsx(sourcePath) {
  const proc = spawnSync("python", ["-c", PY_XLSX_READER, sourcePath], { encoding: "utf8" });
  if (proc.status !== 0) {
    throw new Error(`XLSX import failed: ${proc.stderr || proc.stdout}`);
  }
  return rowsFromTable(JSON.parse(proc.stdout || "[]"));
}

export function parseHistoryFile(sourcePath) {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === ".csv") {
    return parseHistoryCsv(fs.readFileSync(sourcePath, "utf8"));
  }
  if (ext === ".xlsx") {
    return parseHistoryXlsx(sourcePath);
  }
  throw new Error(`Unsupported history import file extension: ${ext || "(none)"}`);
}

export function importHistoryFile(
  sourcePath,
  {
    rawDir = fromRoot("data", "maxim", "imports", "raw"),
    normalizedDir = fromRoot("data", "maxim", "imports", "normalized"),
  } = {},
) {
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(normalizedDir, { recursive: true });
  const sourceBuffer = fs.readFileSync(sourcePath);
  const sourceHash = crypto.createHash("sha256").update(sourceBuffer).digest("hex");
  const batchId = stableId("hist", `${path.resolve(sourcePath)}|${sourceHash}`);
  const rawCopyPath = path.join(rawDir, `${batchId}-${path.basename(sourcePath)}`);
  if (!fs.existsSync(rawCopyPath)) {
    fs.copyFileSync(sourcePath, rawCopyPath);
  }
  const rows = parseHistoryFile(sourcePath);
  const normalizedOutputPath = path.join(normalizedDir, `${batchId}.json`);
  fs.writeFileSync(
    normalizedOutputPath,
    JSON.stringify(
      {
        batchId,
        sourcePath,
        rawCopyPath,
        rows: rows.map((row) => ({
          rowNumber: row.rowNumber,
          normalized: row.normalized,
        })),
      },
      null,
      2,
    ),
  );
  return {
    batchId,
    sourcePath,
    rawCopyPath,
    normalizedOutputPath,
    rows,
    report: {
      rawRowCount: rows.length,
      normalizedRowCount: rows.length,
      issueCount: rows.flatMap((row) => row.normalized.issues).length,
      interviewSignalCount: rows.filter((row) => row.normalized.interviewSignal).length,
    },
  };
}

export const importHistoryCsv = importHistoryFile;
