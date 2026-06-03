import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { rankContactsForJob } from "../../lib/contact-ranker.mjs";
import { buildNetworkingDraft, validateMessageDraft } from "../../lib/message-builder.mjs";
import { SQLiteMaximStore, stableId } from "../../lib/sqlite-store.mjs";

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

test("networking shortlist and manual message drafts persist to the Maxim store", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxim-networking-store-"));
  const store = new SQLiteMaximStore({ dbPath: path.join(tmp, "maxim.db"), eventLog: testEventLog() });
  const job = { id: "job_demo", company: "Acme Systems", role: "Software Engineer" };
  const [ranked] = rankContactsForJob(job, [
    {
      name: "Taylor Recruiter",
      company: "Acme Systems",
      title: "Technical Recruiter",
      connectionStrength: 2,
      notes: "Virginia Tech alumni signal.",
    },
  ]);

  const contact = store.upsertContact(ranked.contact);
  const target = store.upsertNetworkingTarget({
    jobId: job.id,
    contactId: contact.id,
    rankScore: ranked.rankScore,
    rankingReason: ranked.rankingReason,
  });
  const draft = buildNetworkingDraft({ contact, job });
  const validation = validateMessageDraft(draft.draftText);
  const storedDraft = store.upsertMessageDraft({
    targetId: target.id,
    jobId: job.id,
    contactId: contact.id,
    ...draft,
    validation,
  });

  assert.equal(contact.id.startsWith("contact_"), true);
  assert.equal(target.id, stableId("target", `${job.id}|${contact.id}`));
  assert.equal(validation.valid, true);
  assert.equal(storedDraft.status, "ready_to_send");
  assert.equal(store.query("SELECT COUNT(*) AS count FROM contacts")[0].count, 1);
  assert.equal(store.query("SELECT COUNT(*) AS count FROM networking_targets")[0].count, 1);
  assert.equal(store.query("SELECT COUNT(*) AS count FROM message_drafts")[0].count, 1);
  assert.equal(store.query("SELECT COUNT(*) AS count FROM audit_events")[0].count, 1);
});
