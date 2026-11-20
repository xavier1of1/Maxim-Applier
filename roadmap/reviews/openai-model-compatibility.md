# OpenAI Model Compatibility

Date: 2026-11-20 America/New_York. Branch: `maxim/mvp-completion`.

## Checkpoint And Implementation

Pre-change worktree checkpoint: `678663d` (Fix discovery, setup, and reviewed
application handoffs). No push or merge is part of this change.

No new dependency or DB migration. Settings can load account-visible exact IDs,
or accept manual input. The owner-only POST `/api/settings/model/list` accepts
an optional unsaved key, does not persist it, and returns sorted unique model IDs
only. It performs a bounded metadata GET, never generation or candidate disclosure.
Save accepts `api: responses | chat_completions`, default Responses. Legacy runtime
files without `api` default Chat Completions. Check remains metadata-only.

One fetch-based adapter translates Responses text, JSON, function calls/results,
usage and SSE completion into existing internal results. Existing domain checks
and Career-Ops prompt/score semantics remain authoritative. Ordered opaque reasoning
and output items live only in the active tool loop; saved conversation text keeps
its existing disclosure/invalidation rules. Every generation uses `store:false`.
No hosted tools/state, model fallback or automatic billable retry was added.

Unknown model names use estimated local BPE plus existing framing/output reserves
and byte limits, not a guessed context window or false exact billing claim.
Transport/API choice is captured with queued evaluation and interview requests;
changing it requires an explicit fresh request, not hidden reinterpretation.

## Verification

- Full isolated app integration: **130 passed, zero failed**, 434 seconds. The
  unknown-ID test exercises real HTTP/DB/worker chat, exact reasoning/tool replay,
  retained evaluation and consented source interpretation. Interview feedback
  runs its full success/failure/timeout/privacy lane through Responses. The two
  mounted rehearsals cover legacy and Responses transports respectively.
- App unit: **46 passed**, including actual agent-browser and new adapter/context
  checks; Rust: **29 passed**; retained Maxim: **70 passed**.
- Sanitized native Career-Ops: **146 passed**, zero failed, one expected missing-CV
  warning. Native Windows shell path diagnostics remain; independent Maxim privacy
  passes. Go tests pass. Personal trackers are not fixture inputs.
- Final production build/typecheck pass. The rebuilt stack is running on port
  3010 and health confirms database availability, not record freshness.
- Full final Chromium suite: **29 passed, zero failed**, one worker, 4.6 minutes.
  The actual model selector is exercised at 1600px and 390px, including search,
  save, reload, metadata-only checks, manual fallback and no secret disclosure.
  Synthetic desktop/mobile screenshots were visually inspected. Both this suite
  and the integration suite completed with no skipped cases.
- Safety, privacy, diff checks and roadmap validation/tests pass. Fixtures use
  bounded loopback providers and isolated databases, not owner keys. No live model
  generation, employer submission, Gmail authorization or Discord delivery was
  used to certify this change.

Initial runs exposed tests asserting the deliberately removed whitelist, exact
old provider-error wording and the wrong role/name for Astryx's searchable
selector. Corrections keep the actual authorization, context-budget, provider
failure and browser interactions under test rather than skipping cases.

## Acceptance Limits

Account visibility, metadata access and successful task execution are different.
Specialized image/audio/embedding models do not become text agents by appearing
in the list. Unknown names can be attempted without a whitelist update, but real
model access, API capabilities, quota, context and reasoning/output budgets still
apply. Incomplete/refused results fail explicitly. No live model request or
candidate disclosure was performed to certify an arbitrary account/model.
Existing local credentials, user approvals and candidate/application ownership
must remain unchanged. The source-upload report is a separate issue, not closed
by this transport change.
