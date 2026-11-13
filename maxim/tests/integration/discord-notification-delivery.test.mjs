import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { SQLiteMaximStore } from "../../lib/sqlite-store.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));

async function fixture(t, responder) {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), "maxim-discord-fixture-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "maxim", "scripts"), { recursive: true });
  fs.cpSync(path.join(root, "maxim", "lib"), path.join(dir, "maxim", "lib"), { recursive: true });
  fs.cpSync(path.join(root, "maxim", "db"), path.join(dir, "maxim", "db"), { recursive: true });
  fs.copyFileSync(path.join(root, "maxim", "scripts", "discord-notify.mjs"), path.join(dir, "maxim", "scripts", "discord-notify.mjs"));
  fs.symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "junction");
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, url: req.url });
    req.resume();
    responder(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/fixture-webhook`;
  const store = new SQLiteMaximStore({ dbPath: path.join(dir, "data", "maxim", "maxim.db"), schemaPath: path.join(dir, "maxim", "db", "schema.sql") });
  return { dir, requests, url, store };
}

function runNotifier({ dir, url }, args = []) {
  return new Promise((resolve, reject) => {
    const env = {};
    for (const key of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TMPDIR"]) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    env.MAXIM_DISCORD_WEBHOOK_URL = url;
    const child = spawn(process.execPath, [path.join(dir, "maxim", "scripts", "discord-notify.mjs"), ...args], { cwd: dir, env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    const timer = setTimeout(() => child.kill(), 20000);
    child.on("close", () => clearTimeout(timer));
  });
}

test("HTTP 429 leaves the fingerprint retryable and exits unsuccessfully", async (t) => {
  const f = await fixture(t, (_req, res) => { res.writeHead(429); res.end(); });
  const result = await runNotifier(f);
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.store.listNotificationFingerprints(), []);
  assert.notEqual(result.code, 0);
  assert.doesNotMatch(result.stdout + result.stderr, /fixture-webhook/);
});
