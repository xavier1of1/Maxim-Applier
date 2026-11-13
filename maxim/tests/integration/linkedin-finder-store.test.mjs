import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { parseLinkedInPeopleText } from "../../lib/linkedin-connection-finder.mjs";
import { buildNetworkingQueue } from "../../lib/networking-workflow.mjs";
import { SQLiteMaximStore } from "../../lib/sqlite-store.mjs";

function testEventLog() {
  return {
    append: (event) => ({
      event_id: crypto.randomUUID(),
      timestamp: new Date("2026-06-10T12:00:00Z").toISOString(),
      actor: "system",
      ...event,
    }),
  };
}

test("parsed LinkedIn people results can feed the store-backed networking queue", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-linkedin-finder-store-"));
  const store = new SQLiteMaximStore({ dbPath: path.join(tmp, "maxim.db"), eventLog: testEventLog() });
  store.upsertEvaluation({
    id: "eval_linkedin_finder",
    company: "Federal Platform Labs",
    role: "Software Engineer, Mission Systems",
    score: 4.6,
  });
  const job = store.upsertJob({
    id: "job_linkedin_finder",
    evaluationId: "eval_linkedin_finder",
    company: "Federal Platform Labs",
    role: "Software Engineer, Mission Systems",
    tier: "T3",
    nextAction: "build_networking_shortlist",
    careerOpsScore: 4.6,
  });
  const parsed = parseLinkedInPeopleText(
    fs.readFileSync(path.resolve("maxim/tests/fixtures/linkedin-people-results.txt"), "utf8"),
  );
  for (const contact of parsed) {
    store.upsertContact(contact);
  }
  const queue = buildNetworkingQueue({ store, limitJobs: 1, limitContacts: 3, createDrafts: false });
  assert.equal(queue.ok, true);
  assert.equal(queue.jobsConsidered, 1);
  assert.equal(queue.contactsConsidered, 3);
  assert.equal(queue.rankedTargets >= 2, true);
  assert.equal(queue.shortlist[0].jobId, job.id);
  assert.match(queue.shortlist[0].rankingReason, /Same company|Role-lane relevance/);
});

