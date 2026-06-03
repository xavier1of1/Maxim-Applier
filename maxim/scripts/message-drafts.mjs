import fs from "node:fs";

import { buildNetworkingDraft, validateMessageDraft } from "../lib/message-builder.mjs";
import { createStore, stableId } from "../lib/sqlite-store.mjs";

const payloadPath = process.argv[2];
const shouldStore = !process.argv.includes("--no-store");
if (!payloadPath) {
  console.log(
    JSON.stringify(
      { ok: false, message: "Usage: node maxim/scripts/message-drafts.mjs payload.json [--no-store]" },
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
