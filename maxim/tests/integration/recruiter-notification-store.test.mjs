import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { createRecruiterThread, markResponded } from "../../lib/recruiter-inbox.mjs";
import { planNotifications, suppressDuplicateNotifications } from "../../lib/notification-planner.mjs";
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

test("recruiter needs-response state persists and clears when responded", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-recruiter-store-"));
  const store = new SQLiteMaximStore({ dbPath: path.join(tmp, "maxim.db"), eventLog: testEventLog() });
  const created = store.upsertRecruiterThread(
    createRecruiterThread({ subject: "Follow up from recruiter", company: "Acme Systems", tags: ["Needs Response"] }),
  );

  assert.equal(store.listRecruiterNeedsResponse().length, 1);
  store.upsertRecruiterThread(markResponded(created));
  assert.equal(store.listRecruiterNeedsResponse().length, 0);
  assert.equal(store.getRecruiterThread(created.id).status, "Responded");
});

test("notification planner uses persisted high-conviction jobs, drafts, and recruiter reminders", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-notify-store-"));
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
  store.upsertMessageDraft({
    id: "draft_ready",
    jobId: "job_t3",
    contactId: "contact_demo",
    channel: "linkedin_manual",
    draftText: "Person research:\nRole reference:\nXavier background:\nFit rationale:\nCall to action:",
    cta: "quick conversation",
    status: "ready_to_send",
    validation: { valid: true },
  });
  store.upsertRecruiterThread(
    createRecruiterThread({ subject: "Recruiter reply", company: "Acme Systems", tags: ["Needs Response"] }),
  );

  const planned = planNotifications({
    jobs: store.listHighConviction(),
    messageDrafts: store.listReadyMessageDrafts(),
    recruiterThreads: store.listRecruiterNeedsResponse(),
    now: new Date("2026-06-03T12:00:00Z"),
  });

  assert.equal(planned.some((notification) => notification.notificationType === "urgent_fresh_t2_plus"), true);
  assert.equal(planned.some((notification) => notification.notificationType === "message_draft_batch"), true);
  assert.equal(planned.some((notification) => notification.notificationType === "recruiter_needs_response"), true);
  assert.equal(suppressDuplicateNotifications(planned, planned.map((notification) => notification.fingerprint)).length, 0);
});
