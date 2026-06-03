import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { createRecruiterThread } from "../../lib/recruiter-inbox.mjs";
import { buildDashboardSnapshot, writeDashboardSnapshot } from "../../lib/dashboard-snapshot.mjs";
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

test("dashboard snapshot exports store-backed command-center DTOs", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-dashboard-state-"));
  const store = new SQLiteMaximStore({ dbPath: path.join(tmp, "maxim.db"), eventLog: testEventLog() });
  store.upsertJob({
    id: "job_t3",
    evaluationId: "eval_t3",
    company: "Acme Systems",
    role: "Software Engineer",
    tier: "T3",
    nextAction: "Prepare packet.",
    careerOpsScore: 4.7,
  });
  const contact = store.upsertContact({
    name: "Taylor Recruiter",
    company: "Acme Systems",
    title: "Technical Recruiter",
    connectionStrength: 2,
  });
  store.upsertNetworkingTarget({
    jobId: "job_t3",
    contactId: contact.id,
    rankScore: 70,
    rankingReason: "Same company and recruiter signal.",
  });
  store.upsertRecruiterThread(
    createRecruiterThread({ subject: "Follow up from recruiter", company: "Acme Systems", tags: ["Needs Response"] }),
  );
  store.upsertApplication({
    id: "app_t3",
    jobId: "job_t3",
    company: "Acme Systems",
    role: "Software Engineer",
    status: "packet_needed",
    score: 4.7,
    tier: "T3",
    reportPath: "reports/acme.md",
    pdfPath: "output/acme.pdf",
    jobUrl: "https://example.test/jobs/123",
    rawPayload: {
      packetReady: true,
      duplicate: { duplicateRisk: "low", warning: "" },
    },
  });

  const snapshot = buildDashboardSnapshot({ store, now: new Date("2026-06-03T12:00:00Z") });
  assert.equal(snapshot.highConvictionJobs.length, 1);
  assert.equal(snapshot.todayActions.some((action) => action.actionType === "job"), true);
  assert.equal(snapshot.todayActions.some((action) => action.actionType === "recruiter_response"), true);
  assert.equal(snapshot.networkingQueue.length, 1);
  assert.equal(snapshot.recruiterInbox.length, 1);
  assert.equal(snapshot.applications.length, 1);
  assert.equal(snapshot.applications[0].packetReady, true);
  assert.equal(snapshot.applications[0].duplicateRisk, "low");

  const outputPath = path.join(tmp, "dashboard-state.json");
  const written = writeDashboardSnapshot({ store, outputPath, now: new Date("2026-06-03T12:00:00Z") });
  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(written.snapshot.highConvictionJobs[0].tier, "T3");
});
