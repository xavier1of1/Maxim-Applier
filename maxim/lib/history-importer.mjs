import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { fromRoot } from "./path-utils.mjs";

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

export function importHistoryCsv(sourcePath, { rawDir = fromRoot("data", "maxim", "imports", "raw") } = {}) {
  fs.mkdirSync(rawDir, { recursive: true });
  const sourceText = fs.readFileSync(sourcePath, "utf8");
  const rawCopyPath = path.join(rawDir, path.basename(sourcePath));
  if (!fs.existsSync(rawCopyPath)) {
    fs.copyFileSync(sourcePath, rawCopyPath);
  }
  const rows = parseHistoryCsv(sourceText);
  return {
    batchId: stableId("hist", `${sourcePath}|${sourceText.length}`),
    sourcePath,
    rawCopyPath,
    rows,
    report: {
      rawRowCount: rows.length,
      normalizedRowCount: rows.length,
      issueCount: rows.flatMap((row) => row.normalized.issues).length,
      interviewSignalCount: rows.filter((row) => row.normalized.interviewSignal).length,
    },
  };
}
