import test from "node:test";
import assert from "node:assert/strict";

import { buildNetworkingDraft, validateMessageDraft } from "../../lib/message-builder.mjs";

test("drafts include required five-part manual-send structure", () => {
  const draft = buildNetworkingDraft({
    contact: { name: "Morgan Lee", company: "Capitol Automation" },
    job: { company: "Capitol Automation", role: "Forward Deployed Engineer" },
    research: "I saw your work on deployment tooling.",
  });
  const validation = validateMessageDraft(draft.draftText);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.missing, []);
  assert.match(draft.draftText, /Virginia Tech/);
});
