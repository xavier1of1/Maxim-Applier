import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import crypto from "node:crypto";

import { syncCareerOpsArtifacts } from "../../lib/tracker-sync.mjs";
import { SQLiteMaximStore } from "../../lib/sqlite-store.mjs";
import { fromRoot } from "../../lib/path-utils.mjs";

function copyFixtureTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-sync-"));
  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.copyFileSync(
    fromRoot("maxim/tests/fixtures/reports/sample-report.md"),
    path.join(root, "reports", "sample-report.md"),
  );
  fs.copyFileSync(
    fromRoot("maxim/tests/fixtures/data/applications.md"),
    path.join(root, "data", "applications.md"),
  );
  return root;
}

test("sync stores reports and tracker rows idempotently", () => {
  const root = copyFixtureTree();
  const dbPath = path.join(root, "maxim.db");
  const store = new SQLiteMaximStore({ dbPath, eventLog: { append: (event) => ({ event_id: crypto.randomUUID(), timestamp: new Date().toISOString(), actor: "system", ...event }) } });

  const first = syncCareerOpsArtifacts({ root, store, now: new Date("2026-06-02T12:00:00Z") });
  const second = syncCareerOpsArtifacts({ root, store, now: new Date("2026-06-02T12:00:00Z") });

  assert.equal(first.evaluations, 1);
  assert.equal(second.evaluations, 1);
  assert.equal(store.query("SELECT COUNT(*) AS count FROM career_ops_evaluations")[0].count, 1);
  assert.equal(store.query("SELECT COUNT(*) AS count FROM applications")[0].count, 1);
  assert.equal(store.query("SELECT tier FROM maxim_jobs")[0].tier, "T3");
});
