import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";

import { fromRoot } from "../lib/path-utils.mjs";
import { createStore } from "../lib/sqlite-store.mjs";

const requiredPaths = [
  "docs/V2 Redesign/maxim_apply_career_ops_redesign_v2_1.md",
  "docs/V2 Redesign/maxim_apply_career_ops_implementation_roadmap_v1_1.md",
  "docs/maxim/data_onboarding_guide.md",
  "docs/maxim/release_candidate_checklist.md",
  "maxim/db/schema.sql",
  "maxim/lib/tier-router.mjs",
  "data/maxim/templates/contacts.example.csv",
  "data/maxim/templates/evidence_claims.example.yml",
  "data/maxim/events",
];

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0;
}

function listFiles(relativeDir, predicate = () => true) {
  const target = fromRoot(relativeDir);
  if (!fs.existsSync(target)) {
    return [];
  }
  return fs.readdirSync(target).filter((name) => predicate(name));
}

function hasTrackerRows() {
  const trackerPath = fromRoot("data/applications.md");
  if (!fs.existsSync(trackerPath)) {
    return false;
  }
  const rows = fs
    .readFileSync(trackerPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|") && !/^\|\s*-+/.test(line));
  return rows.length > 1;
}

export function runDoctor() {
  const issues = [];
  for (const relativePath of requiredPaths) {
    if (!fs.existsSync(fromRoot(relativePath))) {
      issues.push(`Missing required path: ${relativePath}`);
    }
  }
  if (!commandExists("node")) {
    issues.push("Node is not available.");
  }
  if (!commandExists("python", ["--version"])) {
    issues.push("Python is not available; SQLite bridge cannot run.");
  }

  try {
    createStore().init();
  } catch (error) {
    issues.push(`SQLite store did not initialize: ${error.message}`);
  }

  const careerOpsScripts = ["scan.mjs", "generate-pdf.mjs"];
  const missingCareerOpsScripts = careerOpsScripts.filter((script) => !fs.existsSync(fromRoot(script)));
  const warnings = missingCareerOpsScripts.map(
    (script) => `Career-Ops script not found in this repo root: ${script}`,
  );
  if (!commandExists("go", ["version"])) {
    warnings.push("Go is not available; native dashboard tests cannot run here.");
  }
  if (listFiles("reports", (name) => name.endsWith(".md") && name !== ".gitkeep").length === 0) {
    warnings.push("No real Career-Ops reports found under reports/; maxim:sync will not ingest evaluations yet.");
  }
  if (listFiles("output", (name) => name.toLowerCase().endsWith(".pdf") && name !== ".gitkeep").length === 0) {
    warnings.push("No generated Career-Ops PDFs found under output/; packet readiness will remain incomplete.");
  }
  if (!hasTrackerRows()) {
    warnings.push("data/applications.md has no application rows yet; analytics denominators will be empty.");
  }
  if (!fs.existsSync(fromRoot("article-digest.md")) && !fs.existsSync(fromRoot("data/maxim/templates/evidence_claims.example.yml"))) {
    warnings.push("No approved evidence source detected; generated materials must remain evidence-gated.");
  } else if (!fs.existsSync(fromRoot("article-digest.md"))) {
    warnings.push("No article-digest.md approved evidence bank detected yet; use data/maxim/templates/evidence_claims.example.yml as the intake template.");
  }
  const rawImports = listFiles("data/maxim/imports/raw", (name) => name !== ".gitkeep");
  if (rawImports.length === 0) {
    warnings.push("No real historical tracker import is present yet.");
  } else if (rawImports.every((name) => /fixture|sample|example/i.test(name))) {
    warnings.push("Only fixture/sample historical imports are present; import Xavier's real tracker for operational analytics.");
  }
  if (!process.env.MAXIM_DISCORD_WEBHOOK_URL) {
    warnings.push("MAXIM_DISCORD_WEBHOOK_URL is not set; Discord validation is dry-run only.");
  }

  return { ok: issues.length === 0, issues, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = runDoctor();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
