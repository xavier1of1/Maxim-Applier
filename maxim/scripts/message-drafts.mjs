import fs from "node:fs";

import { buildNetworkingDraft, validateMessageDraft } from "../lib/message-builder.mjs";

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.log(JSON.stringify({ ok: false, message: "Usage: node maxim/scripts/message-drafts.mjs payload.json" }, null, 2));
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
const draft = buildNetworkingDraft(payload);
console.log(JSON.stringify({ ok: true, draft, validation: validateMessageDraft(draft.draftText) }, null, 2));
