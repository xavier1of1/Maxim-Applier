import fs from "node:fs";

import { buildNetworkingDraft, validateMessageDraft } from "../lib/message-builder.mjs";
import {
  MANUAL_MESSAGE_STATUSES,
  buildMessageDraftForTarget,
  markMessageDraftStatus,
  recordNetworkingResearchNote,
} from "../lib/networking-workflow.mjs";
import { createStore, stableId } from "../lib/sqlite-store.mjs";

const args = process.argv.slice(2);
const command = args[0];
const shouldStore = !args.includes("--no-store");

function optionValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

function optionText() {
  const filePath = optionValue("--file");
  if (filePath) {
    return fs.readFileSync(filePath, "utf8").trim();
  }
  const text = optionValue("--text");
  if (text) {
    return text;
  }
  const chunks = [];
  for (let index = 2; index < args.length; index += 1) {
    if (args[index].startsWith("--")) {
      index += 1;
    } else {
      chunks.push(args[index]);
    }
  }
  return chunks.join(" ").trim();
}

function draftDTO(row) {
  return {
    id: row.id,
    targetId: row.target_id ?? null,
    jobId: row.job_id ?? null,
    company: row.job_company ?? "",
    role: row.job_role ?? "",
    contactId: row.contact_id ?? null,
    contactName: row.contact_name ?? "",
    contactTitle: row.contact_title ?? "",
    channel: row.channel,
    status: row.status,
    cta: row.cta,
    rankScore: row.rank_score ?? null,
    rankingReason: row.ranking_reason ?? "",
    updatedAt: row.updated_at,
    preview: `${row.draft_text ?? ""}`.slice(0, 240),
    manualOnly: true,
  };
}

function researchDTO(row) {
  return {
    id: row.id,
    targetId: row.target_id ?? null,
    jobId: row.job_id ?? null,
    company: row.job_company ?? "",
    role: row.job_role ?? "",
    contactId: row.contact_id ?? null,
    contactName: row.contact_name ?? "",
    source: row.source,
    status: row.status,
    updatedAt: row.updated_at,
    researchText: row.research_text,
  };
}

if (command === "list") {
  const explicitStatus = optionValue("--status");
  const status = explicitStatus ?? (args[1]?.startsWith("--") ? null : args[1]);
  const store = createStore();
  const drafts = store.listMessageDrafts({ status }).map(draftDTO);
  console.log(
    JSON.stringify(
      {
        ok: true,
        status: status ?? "all",
        count: drafts.length,
        allowedStatuses: MANUAL_MESSAGE_STATUSES,
        drafts,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (command === "research-list") {
  const explicitTargetId = optionValue("--target-id") ?? optionValue("--target");
  const targetId = explicitTargetId ?? (args[1]?.startsWith("--") ? null : args[1]);
  const status = optionValue("--status");
  const store = createStore();
  const notes = store.listNetworkingResearchNotes({ targetId, status }).map(researchDTO);
  console.log(
    JSON.stringify(
      {
        ok: true,
        targetId: targetId ?? "all",
        status: status ?? "all",
        count: notes.length,
        notes,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (command === "research") {
  const targetId = args[1];
  const researchText = optionText();
  if (!targetId || !researchText) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          message:
            "Usage: node maxim/scripts/message-drafts.mjs research <target-id> --text \"research note\" OR --file path\\to\\research.txt",
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  try {
    const result = recordNetworkingResearchNote({
      store: createStore(),
      targetId,
      researchText,
      source: optionValue("--source") ?? "manual",
      status: optionValue("--status") ?? "approved_for_draft",
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.log(JSON.stringify({ ok: false, message: error.message }, null, 2));
    process.exit(1);
  }
}

if (command === "from-target") {
  const targetId = args[1];
  const researchText = optionText();
  if (!targetId) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          message:
            "Usage: node maxim/scripts/message-drafts.mjs from-target <target-id> [--require-research] [--text \"research note\"|--file path]",
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  try {
    const result = buildMessageDraftForTarget({
      store: createStore(),
      targetId,
      researchText,
      requireResearch: args.includes("--require-research"),
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.log(JSON.stringify({ ok: false, message: error.message }, null, 2));
    process.exit(1);
  }
}

if (command === "status" || command === "mark") {
  const draftId = args[1];
  const status = args[2];
  if (!draftId || !status) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          message: "Usage: node maxim/scripts/message-drafts.mjs status <draft-id> <status>",
          allowedStatuses: MANUAL_MESSAGE_STATUSES,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  try {
    const result = markMessageDraftStatus({ store: createStore(), draftId, status });
    console.log(JSON.stringify({ ...result, allowedStatuses: MANUAL_MESSAGE_STATUSES }, null, 2));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.log(
      JSON.stringify(
        { ok: false, message: error.message, allowedStatuses: MANUAL_MESSAGE_STATUSES },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

const payloadPath = command;
if (!payloadPath) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        message:
          "Usage: node maxim/scripts/message-drafts.mjs payload.json [--no-store] OR list [--status ready_to_send] OR research/research-list/from-target OR status <draft-id> <status>",
        allowedStatuses: MANUAL_MESSAGE_STATUSES,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
const draft = buildNetworkingDraft(payload);
const validation = validateMessageDraft(draft.draftText);
let stored = null;

if (shouldStore) {
  const store = createStore();
  const contact = payload.contact ? store.upsertContact(payload.contact) : null;
  const job = payload.job ?? {};
  const jobId =
    payload.jobId ??
    job.id ??
    job.jobId ??
    stableId("job", `${job.company ?? ""}|${job.role ?? job.title ?? ""}|${job.jobUrl ?? job.url ?? ""}`);
  const targetId =
    payload.targetId ?? (contact ? stableId("target", `${jobId}|${contact.id}`) : null);
  const storedDraft = store.upsertMessageDraft({
    targetId,
    jobId,
    contactId: contact?.id,
    ...draft,
    validation,
  });
  stored = {
    id: storedDraft.id,
    jobId,
    contactId: contact?.id ?? null,
    status: storedDraft.status,
  };
}

console.log(JSON.stringify({ ok: true, draft, validation, stored }, null, 2));
