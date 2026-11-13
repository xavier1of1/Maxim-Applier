import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const scanner = fileURLToPath(new URL("../../../scan.mjs", import.meta.url));

function runScanner(arg) {
  const temporaryHome = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "maxim-scan-cli-test-"));
  try {
    return spawnSync(process.execPath, [scanner, arg], {
      cwd: temporaryHome,
      encoding: "utf8",
      timeout: 8000,
      env: { ...process.env, HTTP_PROXY: "http://127.0.0.1:1", HTTPS_PROXY: "http://127.0.0.1:1", NO_PROXY: "" },
    });
  } finally {
    rmSync(temporaryHome, { recursive: true, force: true });
  }
}

test("scanner help never scans or writes", () => {
  const result = runScanner("--help");
  assert.equal(result.status, 0, `help failed or timed out: ${result.error?.message || result.stderr}`);
  assert.match(result.stdout, /Usage:/i);
  assert.doesNotMatch(result.stdout, /Scanning \d+ companies|New offers added|Results saved/);
});

test("scanner rejects unknown arguments before scanning", () => {
  const result = runScanner("--not-a-real-option");
  assert.equal(result.status, 2, `unknown option must fail fast: ${result.error?.message || result.stderr}`);
  assert.match(result.stderr, /unknown|unrecognized/i);
  assert.doesNotMatch(result.stdout, /Scanning \d+ companies|New offers added|Results saved/);
});
