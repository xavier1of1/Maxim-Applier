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
  queueEligibleApplications,
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
  assert.equal(record.status, "ready_for_assisted_apply");
  assert.equal(record.applyWorkflow.manualSubmissionRequired, true);
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
  assert.equal(record.status, "duplicate_review_required");
  assert.equal(record.tier, "T2");
});

test("apply workflow queues only default eligible synced evaluations", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-application-queue-"));
  const store = new SQLiteMaximStore({ dbPath: path.join(tmp, "maxim.db"), eventLog: testEventLog() });
  const t3 = store.upsertEvaluation({
    id: "eval_ready",
    company: "Federal Platform Labs",
    role: "Software Engineer",
    score: 4.7,
    source: "career_ops",
    reportPath: "reports/fpl.md",
    pdfPath: "output/fpl.pdf",
    jobUrl: "https://example.test/jobs/fpl",
  });
  store.upsertJob({
    evaluationId: t3.id,
    company: t3.company,
    role: t3.role,
    tier: "T3",
    nextAction: "urgent_high_conviction_action",
    careerOpsScore: t3.score,
  });
  const t1 = store.upsertEvaluation({
    id: "eval_review",
    company: "Maybe Co",
    role: "Implementation Analyst",
    score: 3.8,
    source: "career_ops",
    reportPath: "reports/maybe.md",
    pdfPath: "output/maybe.pdf",
    jobUrl: "https://example.test/jobs/maybe",
  });
  store.upsertJob({
    evaluationId: t1.id,
    company: t1.company,
    role: t1.role,
    tier: "T1",
    nextAction: "strategic_override_only",
    careerOpsScore: t1.score,
  });

  const result = queueEligibleApplications({ store });
  assert.equal(result.queuedCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.queued[0].company, "Federal Platform Labs");
  assert.equal(result.queued[0].status, "ready_for_assisted_apply");
  assert.equal(result.safety.manualSubmissionRequired, true);
  assert.equal(store.listApplications().length, 1);

  const second = queueEligibleApplications({ store });
  assert.equal(second.queuedCount, 0);
  assert.equal(second.skipped.some((item) => item.reason === "already_queued"), true);
});

test("apply workflow promotes existing tracker rows when synced evaluation data is ready", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-application-promote-"));
  const store = new SQLiteMaximStore({ dbPath: path.join(tmp, "maxim.db"), eventLog: testEventLog() });
  const evaluation = store.upsertEvaluation({
    id: "eval_promote",
    company: "Sitreps",
    role: "Forward Deployed Engineer",
    score: 4.5,
    source: "career_ops",
    reportPath: "reports/sitreps.md",
    pdfPath: "output/sitreps.pdf",
    jobUrl: "https://example.test/jobs/sitreps",
  });
  store.upsertJob({
    evaluationId: evaluation.id,
    company: evaluation.company,
    role: evaluation.role,
    tier: "T3",
    nextAction: "urgent_high_conviction_action",
    careerOpsScore: evaluation.score,
  });
  const sparse = store.upsertApplication({
    id: "app_sparse_tracker",
    careerOpsRowKey: evaluation.id,
    company: "Sitreps",
    role: "Forward Deployed Engineer",
    status: "Evaluated",
    rawPayload: { source: "tracker" },
  });

  const result = queueEligibleApplications({ store });
  const promoted = store.getApplication(sparse.id);

  assert.equal(result.queuedCount, 1);
  assert.equal(promoted.status, "ready_for_assisted_apply");
  assert.equal(promoted.score, 4.5);
  assert.equal(promoted.tier, "T3");
  assert.equal(promoted.job_url, "https://example.test/jobs/sitreps");
  assert.equal(promoted.report_path, "reports/sitreps.md");
  assert.equal(promoted.pdf_path, "output/sitreps.pdf");
});
