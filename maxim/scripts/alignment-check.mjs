import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { fromRoot } from "../lib/path-utils.mjs";
import { runSafetyCheck } from "./website-safety-check.mjs";

const requiredPaths = [
  "MAXIM_APPLY.md",
  "docs/V2 Redesign/maxim_apply_career_ops_redesign_v2_1.md",
  "docs/V2 Redesign/maxim_apply_career_ops_implementation_roadmap_v1_1.md",
  "docs/V2 Redesign/maxim_apply_operational_inputs_needed.md",
  "docs/maxim/implementation_status.md",
  "docs/maxim/alignment_audit.md",
  "docs/maxim/setup.md",
  "docs/maxim/release_notes.md",
  "docs/maxim/known_limitations.md",
  "docs/maxim/decisions/0001-career-ops-fork-authority.md",
  "docs/maxim/decisions/0002-maxim-extension-boundaries.md",
  "docs/maxim/decisions/0003-local-sqlite-extension-store.md",
  "docs/maxim/decisions/0004-dashboard-integration-strategy.md",
  "docs/maxim/testing/website-safety-test-plan.md",
  "docs/maxim/testing/dashboard-test-plan.md",
  "docs/maxim/testing/upstream-merge-test-plan.md",
  "maxim/db/schema.sql",
  "maxim/lib/tier-router.mjs",
  "maxim/lib/policy-engine.mjs",
  "maxim/lib/sqlite-store.mjs",
  "maxim/lib/tracker-sync.mjs",
  "dashboard/internal/maxim/model.go",
  "dashboard/internal/maxim/service/service.go",
];

const requiredScripts = [
  "maxim:doctor",
  "maxim:sync",
  "maxim:tier",
  "maxim:import-history",
  "maxim:networking",
  "maxim:message-drafts",
  "maxim:recruiter-inbox",
  "maxim:application",
  "maxim:dashboard-state",
  "maxim:notify",
  "maxim:analytics",
  "maxim:safety",
  "maxim:test",
  "maxim:alignment",
];

const requiredTables = [
  "career_ops_evaluations",
  "career_ops_artifacts",
  "maxim_jobs",
  "applications",
  "contacts",
  "networking_targets",
  "message_drafts",
  "recruiter_threads",
  "notifications",
  "metric_snapshots",
  "user_decisions",
  "audit_events",
  "historical_import_batches",
  "historical_application_raw_rows",
  "historical_application_normalized_rows",
];

const userLayerFiles = [
  "cv.md",
  "config/profile.yml",
  "modes/_profile.md",
  "portals.yml",
  "data/applications.md",
];

function run(command, args) {
  return spawnSync(command, args, { cwd: fromRoot(), encoding: "utf8" });
}

function changedFiles() {
  for (const ref of ["upstream/main", "origin/main"]) {
    const result = run("git", ["diff", "--name-only", `${ref}...HEAD`]);
    if (result.status === 0) {
      return { ref, files: result.stdout.split(/\r?\n/).filter(Boolean), warning: "" };
    }
  }
  return {
    ref: "",
    files: [],
    warning: "Could not compare fork changes against upstream/main or origin/main.",
  };
}

function isAllowedPatch(relativePath) {
  return (
    relativePath === ".gitignore" ||
    relativePath === "AGENTS.md" ||
    relativePath === "MAXIM_APPLY.md" ||
    relativePath === "package.json" ||
    relativePath === "dashboard/main.go" ||
    relativePath === "dashboard/internal/ui/screens/pipeline.go" ||
    relativePath.startsWith("dashboard/internal/maxim/") ||
    relativePath.startsWith("docs/V2 Redesign/") ||
    relativePath.startsWith("docs/maxim/") ||
    relativePath.startsWith("data/maxim/") ||
    relativePath.startsWith("maxim/")
  );
}

function trackedUserLayerFiles() {
  const result = run("git", ["ls-files", ...userLayerFiles]);
  if (result.status !== 0) {
    return [];
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

export function runAlignmentCheck() {
  const issues = [];
  const warnings = [];

  for (const relativePath of requiredPaths) {
    if (!fs.existsSync(fromRoot(relativePath))) {
      issues.push(`Missing required Maxim authority or extension path: ${relativePath}`);
    }
  }

  const packageJson = JSON.parse(fs.readFileSync(fromRoot("package.json"), "utf8"));
  for (const script of requiredScripts) {
    if (!packageJson.scripts?.[script]) {
      issues.push(`Missing package script: ${script}`);
    }
  }

  const schema = fs.existsSync(fromRoot("maxim/db/schema.sql"))
    ? fs.readFileSync(fromRoot("maxim/db/schema.sql"), "utf8")
    : "";
  for (const table of requiredTables) {
    if (!new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\b`, "i").test(schema)) {
      issues.push(`Missing SQLite table: ${table}`);
    }
  }

  const trackedUserFiles = trackedUserLayerFiles();
  if (trackedUserFiles.length > 0) {
    issues.push(`User-layer files are tracked but should remain local-only: ${trackedUserFiles.join(", ")}`);
  }

  const diff = changedFiles();
  if (diff.warning) {
    warnings.push(diff.warning);
  }
  const outsidePatchBoundary = diff.files.filter((file) => !isAllowedPatch(file));
  if (outsidePatchBoundary.length > 0) {
    issues.push(`Files changed outside documented patch boundaries: ${outsidePatchBoundary.join(", ")}`);
  }

  const safety = runSafetyCheck();
  if (!safety.ok) {
    issues.push(`Platform safety check failed: ${JSON.stringify(safety.findings)}`);
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    comparedAgainst: diff.ref,
    changedFileCount: diff.files.length,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = runAlignmentCheck();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
