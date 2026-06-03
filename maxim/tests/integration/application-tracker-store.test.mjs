import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import {
  buildApplicationRecord,
  markAssistedApplyStarted,
  markSubmittedManually,
} from "../../lib/application-tracker.mjs";
import { SQLiteMaximStore } from "../../lib/sqlite-store.mjs";

function testEventLog() {
  return {
    append: (event) => ({
      event_id: crypto.randomUUID(),
      timestamp: new Date("2026-06-03T12:00:00Z").toISOString(),
      actor: "system",
      ...event,
    }),
  };
}

test("application records preserve Career-Ops score/tier and manual status transitions", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-application-store-"));
  const store = new SQLiteMaximStore({ dbPath: path.join(tmp, "maxim.db"), eventLog: testEventLog() });
  const evaluation = store.upsertEvaluation({
    id: "eval_app",
    company: "Acme Systems",
    role: "Software Engineer",
    score: 4.6,
    source: "career_ops",
    reportPath: "reports/acme.md",
    pdfPath: "output/acme.pdf",
    jobUrl: "https://example.test/jobs/123",
  });
  const job = store.upsertJob({
    evaluationId: evaluation.id,
    company: evaluation.company,
    role: evaluation.role,
    tier: "T3",
    nextAction: "Prepare packet.",
    careerOpsScore: evaluation.score,
  });

  const record = buildApplicationRecord({ job, evaluation, priorApplications: [] });
  const stored = store.upsertApplication(record);
  const started = store.upsertApplication(markAssistedApplyStarted(stored));
  const submitted = store.upsertApplication(markSubmittedManually(started, new Date("2026-06-03T12:00:00Z")));

  assert.equal(record.packetReady, true);
  assert.equal(stored.score, 4.6);
  assert.equal(stored.tier, "T3");
  assert.equal(started.status, "assisted_apply_started");
  assert.equal(submitted.status, "submitted_manually");
  assert.equal(submitted.appliedAt, "2026-06-03T12:00:00.000Z");
});

test("application records surface duplicate risk for same company role or URL", () => {
  const evaluation = {
    company: "Acme Systems",
    role: "Software Engineer",
    score: 4.2,
    source: "career_ops",
    jobUrl: "https://example.test/jobs/123",
  };
  const record = buildApplicationRecord({
    job: { id: "job_123" },
    evaluation,
    priorApplications: [
      {
        company: "Acme Systems",
        role: "Software Engineer",
        jobUrl: "https://example.test/jobs/123",
        jobId: "job_123",
      },
    ],
  });

  assert.equal(record.duplicate.duplicateRisk, "high");
  assert.equal(record.duplicate.action, "hold_for_review");
  assert.equal(record.tier, "T2");
});
