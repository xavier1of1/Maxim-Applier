import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { fromRoot } from "./path-utils.mjs";

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1]?.trim();
    }
  }
  return undefined;
}

export function parseCareerOpsReport(text, { reportPath = undefined } = {}) {
  const evaluationTitle = text.match(/^#\s*Evaluation:\s*(.+?)\s+[—–-]\s+(.+?)\s*$/im);
  const genericTitle = text.match(/^#\s+(.+?)\s+[-|]\s+(.+?)\s*$/im);
  const scoreRaw = firstMatch(text, [
    /^\s*\*\*(?:career-ops\s*)?score:\*\*\s*([0-5](?:\.\d+)?)(?:\s*\/\s*5)?/im,
    /^\s*(?:career-ops\s*)?score\s*[:\-]\s*([0-5](?:\.\d+)?)(?:\s*\/\s*5)?/im,
    /^\s*fit\s*score\s*[:\-]\s*([0-5](?:\.\d+)?)(?:\s*\/\s*5)?/im,
    /^\s*rating\s*[:\-]\s*([0-5](?:\.\d+)?)(?:\s*\/\s*5)?/im,
  ]);
  const company = firstMatch(text, [
    /^\s*\*\*company:\*\*\s*(.+)$/im,
    /^\s*company\s*[:\-]\s*(.+)$/im,
    /^\s*employer\s*[:\-]\s*(.+)$/im,
  ]);
  const role = firstMatch(text, [
    /^\s*\*\*(?:role|title|position):\*\*\s*(.+)$/im,
    /^\s*(?:role|title|position)\s*[:\-]\s*(.+)$/im,
  ]);
  const url = firstMatch(text, [
    /^\s*\*\*(?:job\s*)?url:\*\*\s*(https?:\/\/\S+)/im,
    /^\s*(?:job\s*)?url\s*[:\-]\s*(https?:\/\/\S+)/im,
    /\b(https?:\/\/\S+)/i,
  ]);
  const locationText = firstMatch(text, [/^\s*(?:\*\*)?location(?:s)?(?:\*\*)?\s*[:\-]\s*(.+)$/im]);
  const salaryText = firstMatch(text, [/^\s*(?:\*\*)?(?:salary|compensation)(?:\*\*)?\s*[:\-]\s*(.+)$/im]);
  const postedAt = firstMatch(text, [/^\s*(?:\*\*)?(?:posted|date posted)(?:\*\*)?\s*[:\-]\s*(.+)$/im]);
  const source = firstMatch(text, [/^\s*(?:\*\*)?source(?:\*\*)?\s*[:\-]\s*(.+)$/im]) ?? "career_ops_report";
  const summary = firstMatch(text, [
    /^\s*(?:\*\*)?summary(?:\*\*)?\s*[:\-]\s*(.+)$/im,
    /^\s*(?:\*\*)?recommendation(?:\*\*)?\s*[:\-]\s*(.+)$/im,
  ]);

  const pathStem = reportPath ? path.basename(reportPath, path.extname(reportPath)) : "report";
  const titleCompany = evaluationTitle?.[1]?.trim() ?? genericTitle?.[1]?.trim();
  const titleRole = evaluationTitle?.[2]?.trim() ?? genericTitle?.[2]?.trim();
  return {
    id: `eval_${hash(reportPath ? `${reportPath}|${text}` : text)}`,
    reportPath,
    company: titleCompany ?? company ?? inferCompanyFromPath(pathStem),
    role: titleRole ?? role ?? inferRoleFromPath(pathStem),
    score: scoreRaw ? Number(scoreRaw) : undefined,
    source,
    jobUrl: url,
    locationText,
    salaryText,
    postedAt,
    summary,
    rawPayload: { parser: "tolerant_markdown_v1" },
  };
}

function inferCompanyFromPath(stem) {
  const parts = stem.split(/[_-]+/).filter(Boolean);
  return parts.length > 1 ? titleCase(parts[0]) : undefined;
}

function inferRoleFromPath(stem) {
  const parts = stem.split(/[_-]+/).filter(Boolean);
  return parts.length > 1 ? titleCase(parts.slice(1).join(" ")) : undefined;
}

function titleCase(value) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function parseApplicationsMd(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
  if (lines.length < 2) {
    return [];
  }
  const header = lines[0]
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  return lines
    .slice(2)
    .map((line, index) => {
      const cells = line
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);
      const raw = Object.fromEntries(header.map((key, cellIndex) => [key, cells[cellIndex] ?? ""]));
      return {
        id: `app_${hash(JSON.stringify(raw))}`,
        careerOpsRowKey: hash(JSON.stringify(raw)),
        company: raw.Company ?? raw.company ?? raw.Employer,
        role: raw.Role ?? raw.role ?? raw.Title ?? raw.Position,
        status: raw.Status ?? raw.status ?? raw["Application Status"] ?? "synced",
        appliedAt: raw.Date ?? raw["Date Submitted"] ?? raw.Applied,
        source: raw.Source ?? raw.source,
        jobUrl: raw.URL ?? raw.Link ?? raw.link,
        rawPayload: { rowNumber: index + 1, raw },
      };
    });
}

export function discoverCareerOpsArtifacts({
  root = fromRoot(),
  reportsDir = "reports",
  outputDir = "output",
  applicationsPath = "data/applications.md",
} = {}) {
  const reportsRoot = path.join(root, reportsDir);
  const outputRoot = path.join(root, outputDir);
  const reportPaths = fs.existsSync(reportsRoot)
    ? fs
        .readdirSync(reportsRoot)
        .filter((name) => name.endsWith(".md"))
        .map((name) => path.join(reportsRoot, name))
    : [];
  const pdfPaths = fs.existsSync(outputRoot)
    ? fs
        .readdirSync(outputRoot)
        .filter((name) => name.toLowerCase().endsWith(".pdf"))
        .map((name) => path.join(outputRoot, name))
    : [];
  const trackerPath = path.join(root, applicationsPath);
  return {
    reportPaths,
    pdfPaths,
    trackerPath: fs.existsSync(trackerPath) ? trackerPath : undefined,
  };
}

export function parseReportFile(reportPath) {
  return parseCareerOpsReport(fs.readFileSync(reportPath, "utf8"), { reportPath });
}

export function parseTrackerFile(trackerPath) {
  return parseApplicationsMd(fs.readFileSync(trackerPath, "utf8"));
}
