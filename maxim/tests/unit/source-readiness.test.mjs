import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../scripts/audit-sources.mjs", import.meta.url));

function audit(config) {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), "source-audit-"));
  try {
    const configPath = path.join(tmp, "portals.json"); // JSON is valid YAML
    fs.writeFileSync(configPath, JSON.stringify(config));
    const run = spawnSync(process.execPath, [script, configPath], { encoding: "utf8", cwd: tmp });
    assert.equal(run.status, 0, `source readiness audit must classify sources offline: ${run.stderr}`);
    assert.deepEqual(fs.readdirSync(tmp), ["portals.json"], "audit must not write user data");
    return JSON.parse(run.stdout);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test("help explains the read-only audit without needing portals.yml", () => {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), "source-help-"));
  try {
    const run = spawnSync(process.execPath, [script, "--help"], {
      encoding: "utf8", cwd: tmp, env: { ...process.env, CAREER_OPS_PORTALS: path.join(tmp, "absent.yml") },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /offline, read-only/i);
    assert.match(run.stdout, /does not verify/i);
    assert.deepEqual(fs.readdirSync(tmp), []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("audit classifies supported, unsupported websearch, and disabled sources without scanning", () => {
  const result = audit({ tracked_companies: [
    { name: "Supported", enabled: true, careers_url: "https://job-boards.greenhouse.io/example" },
    { name: "Manual research", enabled: true, careers_url: "https://example.test/careers", scan_method: "websearch" },
    { name: "Unknown", provider: "nonexistent", careers_url: "https://jobs.lever.co/example" },
    { name: "Explicit but not resolvable", provider: "lever", careers_url: "https://example.test/careers" },
    { name: "Local parser", parser: { command: "node", script: "missing-parser.mjs" }, careers_url: "https://job-boards.greenhouse.io/example" },
    { enabled: false },
    { enabled: true, careers_url: "https://job-boards.greenhouse.io/example" },
    null,
    { name: "Disabled", enabled: false, careers_url: "https://jobs.lever.co/disabled" },
  ] });
  assert.deepEqual(result.counts, { total: 9, enabled: 5, selected: 3, unmatched: 1, invalid: 2, unknownProvider: 1, disabled: 2 });
  assert.deepEqual(result.sources.map(({ name, status, provider }) => ({ name, status, provider })), [
    { name: "Supported", status: "selected", provider: "greenhouse" },
    { name: "Manual research", status: "unmatched", provider: null },
    { name: "Unknown", status: "unknownProvider", provider: null },
    { name: "Explicit but not resolvable", status: "selected", provider: "lever" },
    { name: "Local parser", status: "selected", provider: "greenhouse" },
    { name: null, status: "disabled", provider: null },
    { name: null, status: "invalid", provider: null },
    { name: null, status: "invalid", provider: null },
    { name: "Disabled", status: "disabled", provider: null },
  ]);
  assert.match(result.sources[1].reason, /websearch/i);
  assert.match(result.sources[3].reason, /explicit.*not.*verified/i);
  assert.match(result.sources[4].reason, /local parser.*not selected/i);
});
