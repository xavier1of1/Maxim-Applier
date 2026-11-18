import test from "node:test";
import {fixtureDirectory} from "../../lib/test-resources.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { rankContactsForJob } from "../../lib/contact-ranker.mjs";
import { buildNetworkingDraft, validateMessageDraft } from "../../lib/message-builder.mjs";
import {
  buildMessageDraftForTarget,
  buildNetworkingQueue,
  markMessageDraftStatus,
  recordNetworkingResearchNote,
} from "../../lib/networking-workflow.mjs";
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

test("networking shortlist and manual message drafts persist to the Maxim store", (t) => {
  const tmp = fixtureDirectory(t, "maxim-networking-store-");
  const store = new SQLiteMaximStore({ dbPath: path.join(tmp, "maxim.db"), eventLog: testEventLog() });
  const job = { id: "job_demo", company: "Acme Systems", role: "Software Engineer" };
  const [ranked] = rankContactsForJob(job, [
    {
      name: "Taylor Recruiter",
      company: "Acme Systems",
      title: "Technical Recruiter",
      connectionStrength: 2,
      vtAlumni: true,
      recruiterSignal: true,
      founderSignal: false,
      roleRelevance: "software automation",
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
  const storedContact = store.query("SELECT * FROM contacts WHERE id = ?", [contact.id])[0];
  assert.equal(storedContact.vt_alumni, 1);
  assert.equal(storedContact.recruiter_signal, 1);
  assert.equal(storedContact.founder_signal, 0);
  assert.equal(storedContact.role_relevance, "software automation");
  assert.match(storedContact.raw_payload_json, /Technical Recruiter/);
  assert.equal(store.query("SELECT COUNT(*) AS count FROM audit_events")[0].count, 1);
});

test("store-backed networking queue creates manual drafts and preserves sent status on rerun", (t) => {
  const tmp = fixtureDirectory(t, "maxim-networking-workflow-");
  const store = new SQLiteMaximStore({ dbPath: path.join(tmp, "maxim.db"), eventLog: testEventLog() });
  store.upsertEvaluation({
    id: "eval_federal_platform_labs",
    company: "Federal Platform Labs",
    role: "Software Engineer, Mission Systems",
    score: 4.6,
    jobUrl: "https://example.invalid/fpl",
  });
  const job = store.upsertJob({
    id: "job_federal_platform_labs",
    evaluationId: "eval_federal_platform_labs",
    company: "Federal Platform Labs",
    role: "Software Engineer, Mission Systems",
    tier: "T3",
    nextAction: "urgent_high_conviction_action",
    careerOpsScore: 4.6,
  });
  store.upsertContact({
    name: "Riley Recruiter",
    company: "Federal Platform Labs",
    title: "Technical Recruiter",
    connectionStrength: 2,
    recruiterSignal: true,
    roleRelevance: "software engineering",
  });
  store.upsertContact({
    name: "Unrelated Contact",
    company: "Elsewhere",
    title: "Sales Representative",
  });

  const first = buildNetworkingQueue({ store, createDrafts: true, limitJobs: 5, limitContacts: 5 });
  assert.equal(first.ok, true);
  assert.equal(first.jobsConsidered, 1);
  assert.equal(first.rankedTargets, 1);
  assert.equal(first.storedDrafts, 1);
  assert.equal(first.shortlist[0].jobId, job.id);
  assert.equal(first.shortlist[0].draftStatus, "ready_to_send");
  assert.equal(first.shortlist[0].manualOnly, true);

  const draftId = first.shortlist[0].draftId;
  const marked = markMessageDraftStatus({ store, draftId, status: "sent_manually" });
  assert.equal(marked.ok, true);
  assert.equal(marked.draft.status, "sent_manually");
  assert.equal(store.listNetworkingQueue()[0].draft_status, "sent_manually");
  assert.equal(store.listNetworkingQueue()[0].status, "sent_manually");

  const second = buildNetworkingQueue({ store, createDrafts: true, limitJobs: 5, limitContacts: 5 });
  assert.equal(second.rankedTargets, 1);
  assert.equal(store.listMessageDrafts({ status: "sent_manually" }).length, 1);
  assert.equal(store.listNetworkingQueue()[0].status, "sent_manually");
});

test("approved research notes feed target-specific manual draft creation", (t) => {
  const tmp = fixtureDirectory(t, "maxim-networking-research-");
  const store = new SQLiteMaximStore({ dbPath: path.join(tmp, "maxim.db"), eventLog: testEventLog() });
  store.upsertEvaluation({
    id: "eval_research_context",
    company: "Capitol Automation",
    role: "Forward Deployed Engineer",
    score: 4.4,
  });
  store.upsertJob({
    id: "job_research_context",
    evaluationId: "eval_research_context",
    company: "Capitol Automation",
    role: "Forward Deployed Engineer",
    tier: "T2",
    nextAction: "build_networking_shortlist",
    careerOpsScore: 4.4,
  });
  store.upsertContact({
    name: "Jordan Principal",
    company: "Capitol Automation",
    title: "Principal Software Engineer",
    connectionStrength: 2,
    roleRelevance: "software automation",
  });

  const queue = buildNetworkingQueue({ store, createDrafts: false, limitJobs: 1, limitContacts: 1 });
  const targetId = queue.shortlist[0].targetId;
  const blocked = buildMessageDraftForTarget({ store, targetId, requireResearch: true });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.researchRequired, true);

  const research = "I saw your public engineering leadership work around automation delivery.";
  const note = recordNetworkingResearchNote({ store, targetId, researchText: research });
  assert.equal(note.ok, true);
  assert.equal(note.note.status, "approved_for_draft");

  const built = buildMessageDraftForTarget({ store, targetId, requireResearch: true });
  assert.equal(built.ok, true);
  assert.equal(built.draft.status, "ready_to_send");
  assert.match(built.draftText, /automation delivery/);
  assert.equal(built.manualOnly, true);
  assert.equal(store.listNetworkingResearchNotes({ targetId }).length, 1);
  const [queueRow] = store.listNetworkingQueue();
  assert.equal(queueRow.research_note_id, note.note.id);
  assert.equal(queueRow.draft_status, "ready_to_send");
});
