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
  fs.mkdirSync(path.join(root, "output"), { recursive: true });
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.copyFileSync(
    fromRoot("maxim/tests/fixtures/reports/sample-report.md"),
    path.join(root, "reports", "sample-report.md"),
  );
  fs.copyFileSync(
    fromRoot("maxim/tests/fixtures/output/federal-platform-labs-software-engineer.pdf"),
    path.join(root, "output", "federal-platform-labs-software-engineer.pdf"),
  );
  fs.copyFileSync(
    fromRoot("maxim/tests/fixtures/data/applications.md"),
    path.join(root, "data", "applications.md"),
  );
  fs.mkdirSync(path.join(root, "data", "maxim"), { recursive: true });
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
  assert.match(store.query("SELECT pdf_path FROM career_ops_evaluations")[0].pdf_path, /federal-platform-labs-software-engineer\.pdf$/);
  assert.equal(store.query("SELECT tier FROM maxim_jobs")[0].tier, "T3");
  const application = store.query("SELECT * FROM applications")[0];
  assert.equal(application.score, 4.6);
  assert.equal(application.tier, "T3");
  assert.match(application.job_url, /federal-platform-labs\/software-engineer$/);
  assert.match(application.report_path, /sample-report\.md$/);
  assert.match(application.pdf_path, /federal-platform-labs-software-engineer\.pdf$/);
});

test("sync applies local job URL overrides without rewriting reports", () => {
  const root = copyFixtureTree();
  fs.writeFileSync(
    path.join(root, "data", "maxim", "job_url_overrides.json"),
    JSON.stringify(
      {
        overrides: [
          {
            match: {
              sourceUrl: "https://example.com/federal-platform-labs/software-engineer",
              company: "Federal Platform Labs",
              role: "Software Engineer",
            },
            jobUrl: "https://jobs.lever.co/federal-platform-labs/official",
            reason: "fixture override",
          },
        ],
      },
      null,
      2,
    ),
  );
  const store = new SQLiteMaximStore({
    dbPath: path.join(root, "maxim.db"),
    eventLog: { append: (event) => ({ event_id: crypto.randomUUID(), timestamp: new Date().toISOString(), actor: "system", ...event }) },
  });

  syncCareerOpsArtifacts({ root, store, now: new Date("2026-06-02T12:00:00Z") });

  const evaluation = store.query("SELECT * FROM career_ops_evaluations")[0];
  const application = store.query("SELECT * FROM applications")[0];
  assert.equal(evaluation.job_url, "https://jobs.lever.co/federal-platform-labs/official");
  assert.equal(application.job_url, "https://jobs.lever.co/federal-platform-labs/official");
});
