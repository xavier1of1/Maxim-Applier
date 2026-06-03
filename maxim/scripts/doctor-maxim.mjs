import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { fromRoot } from "../lib/path-utils.mjs";
import { createStore } from "../lib/sqlite-store.mjs";

const requiredPaths = [
  "docs/V2 Redesign/maxim_apply_career_ops_redesign_v2_1.md",
  "docs/V2 Redesign/maxim_apply_career_ops_implementation_roadmap_v1_1.md",
  "maxim/db/schema.sql",
  "maxim/lib/tier-router.mjs",
  "data/maxim/events",
];

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0;
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

  return { ok: issues.length === 0, issues, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = runDoctor();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
