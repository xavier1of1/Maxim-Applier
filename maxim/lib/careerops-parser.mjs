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
  const scoreRaw = firstMatch(text, [
    /(?:career-ops\s*)?score\s*[:\-]\s*([0-5](?:\.\d+)?)(?:\s*\/\s*5)?/i,
    /fit\s*score\s*[:\-]\s*([0-5](?:\.\d+)?)(?:\s*\/\s*5)?/i,
    /rating\s*[:\-]\s*([0-5](?:\.\d+)?)(?:\s*\/\s*5)?/i,
  ]);
  const company = firstMatch(text, [
    /company\s*[:\-]\s*(.+)/i,
    /employer\s*[:\-]\s*(.+)/i,
  ]);
  const role = firstMatch(text, [
    /(?:role|title|position)\s*[:\-]\s*(.+)/i,
    /^#\s+(.+?)\s+[-|]\s+(.+)$/im,
  ]);
  const url = firstMatch(text, [
    /(?:job\s*)?url\s*[:\-]\s*(https?:\/\/\S+)/i,
    /\b(https?:\/\/\S+)/i,
  ]);
  const locationText = firstMatch(text, [/location(?:s)?\s*[:\-]\s*(.+)/i]);
  const salaryText = firstMatch(text, [/(?:salary|compensation)\s*[:\-]\s*(.+)/i]);
  const postedAt = firstMatch(text, [/(?:posted|date posted)\s*[:\-]\s*(.+)/i]);
  const source = firstMatch(text, [/source\s*[:\-]\s*(.+)/i]) ?? "career_ops_report";
  const summary = firstMatch(text, [
    /summary\s*[:\-]\s*(.+)/i,
    /recommendation\s*[:\-]\s*(.+)/i,
  ]);

  const pathStem = reportPath ? path.basename(reportPath, path.extname(reportPath)) : "report";
  return {
    id: `eval_${hash(reportPath ? `${reportPath}|${text}` : text)}`,
    reportPath,
    company: company ?? inferCompanyFromPath(pathStem),
    role: role ?? inferRoleFromPath(pathStem),
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
