# S2: Reviewed candidate onboarding

**Status:** Pending implementation. Detailed plan drafted; no acceptance criterion is claimed passed.
**Updated:** 2026-11-16.
**Roadmap:** [Stage index](README.md) | [High-level roadmap](../high-level-roadmap.md) | [Shared contracts](contracts.md)
**Requires:** [S1](stage-01-workspace-and-agent.md)

> **How to pick this up:** Implement only this file's Scope and Acceptance, in the ordered slices below. Existing paths are evidence, not a promise of compatible behavior. Proposed files/tests do not exist until implemented. Dependencies require their own recorded proof; planning status never satisfies them.

## Objective

Turn private uploads and conversational input into reviewed candidate knowledge, with the first real durable worker and a controlled candidate-authority cutover.

## Thin Vertical Slice

- **Narrowness axis:** PDF/DOCX/MD/TXT resume intake, source-linked proposals, one conflict and one approved correction.
- **E2E path:** upload synthetic resume; extraction job survives worker restart; review fields/conflict; reject one claim; confirm another; reopen UI/agent and retained Career-Ops context after restart.
- **Counterexample:** unreadable input, model-consent denial or an expired worker lease never creates approved facts.
- **Outside this slice:** OCR as a guarantee, novel-answer automation, applications migration, browser actions.

## Current Evidence And Boundary

Current sources are CV/profile/personal modes/evidence files under [DATA_CONTRACT](../../DATA_CONTRACT.md). Existing SQLite [schema](../../maxim/db/schema.sql) has jobs/networking/history but not a reviewed candidate knowledge or extraction-job model.

Do not infer current approved claims by scanning filenames or treating every legacy resume as current. The user must review imported facts; no public/proprietary upload is needed to prove this stage.

## Scope And Contracts

- Implement source metadata/private bytes, extraction runs/proposals, typed facts/preferences, revisions, approval/sensitivity and dependencies.
- Choose and pin maintained parsers for the four formats, validate signatures/size/page/decompression limits and reject unsupported active/encrypted content. Define explicit numeric limits in implementation config/tests; extension alone is insufficient.
- Local extraction first. Model interpretation only after clear consent/disclosure and minimized/redacted content; no prohibited Wabtec/employer material. No-model/manual entry remains useful.
- Introduce durable job tables, claim/renew/complete/cancel and worker process using PostgreSQL transactions/leases. Extraction is the first consumer; later stages must reuse it.
- Show upload/queued/running/failed/review-required/approved states. Uploaded is not onboarded; confidence is not truth verification.
- Conflicts are field/source/revision-specific; no silent import-wins merge. Support duplicate source hashes, partial onboarding and corrections.
- Perform candidate-family staging/reconciliation/cutover with protected backup/rollback and explicit gating of native profile writers. Produce Career-Ops-compatible input projections after cutover.
- Define correction and deletion/retention behavior for source text/proposals/events/derived context, without rewriting historical submitted packets.

## Ordered Implementation Slices

| Slice | Action | Result and proof |
| --- | --- | --- |
| ONB-A | Private upload validation, metadata and dedupe | Same source reuses identity; malformed/oversized input never executes |
| ONB-B | Worker lease/attempt/cancel mechanics plus real parser job | Restart/two-worker/lost-lease fixture with one finalized extraction |
| ONB-C | Review UI + agent read/propose controls | Review exact proposals and conflicts, not whole-chat auto-memory |
| ONB-D | Confirmation and dependent-context invalidation | Source-linked facts persist; rejected facts absent from context |
| ONB-E | Legacy candidate import/projection/cutover | One writer, explicit mode/CLI changes, repeatable restore |

## Acceptance

- [ ] **ONB-01:** Each supported format has representative source/extraction fixtures; scanned, corrupt, encrypted, oversized and archive-abuse cases return explicit safe outcomes.
- [ ] **ONB-02:** Source/hash/proposal/fact identities and revisions survive duplicate upload and restart without silent overwrite.
- [ ] **ONB-03:** Worker restart/retry/cancel/two-worker/lost-lease cases finalize at most one current extraction for the expected source revision.
- [ ] **ONB-04:** Only explicit reviewed confirmation creates current facts; conflict/rejection/partial onboarding behave consistently through UI and agent.
- [ ] **ONB-05:** Denied model disclosure and restricted employer sources never enter captured model requests; local/manual onboarding still functions.
- [ ] **ONB-06:** Corrected facts invalidate dependent current contexts/drafts and rejected or withdrawn proposals are excluded.
- [ ] **ONB-07:** Candidate import, native read projections and all supported writer gates prove one authority; rollback restores the prior owner with no lost acknowledged edits.
- [ ] **ONB-08:** Private downloads, second candidate access, path traversal, source deletion/retention and backup restore pass their policy tests.

## Integration Test

**Proposed:** `node --test maxim/app/tests/integration/onboarding.test.mjs` and `maxim/app/tests/e2e/onboarding.spec.mjs`. Requires S1's real isolated app/DB/model harness, not an in-memory fake repository.

Run the actual worker claim path with fixture parser/model adapters, then at least one real local parser fixture per supported format. Crash after parsing before publication; revoke consent/change revision while queued; lose a lease; restart and correct a previously approved fact.

A PDF parser returning text is not a claim that scanned resumes or all DOCX content are supported. Maintain a visible input-support matrix.

## Files Changed

~~~text
maxim/app/src/server/{sources,candidates,projections}/
maxim/app/src/server/work/                       durable jobs/leases/attempts
maxim/app/src/worker/{main,extraction}.ts         first real worker consumer
maxim/app/src/app/                              onboarding/review routes
maxim/app/src/components/                       upload, conflict and fact-review controls
maxim/db/postgres/                              source/fact/proposal/job migrations
maxim/app/tests/{fixtures,integration,e2e}/      synthetic documents, worker/race tests
AGENTS.md, CLAUDE.md                            narrow native writer guidance/gates at cutover
config/profile.yml, modes/_profile.md            approved generated user-layer projections only
DATA_CONTRACT.md                                 update only with implemented authority switch
~~~
The last two rows are migration patches, not permission to place private facts in system instructions. Keep user customizations protected.

## Dependencies And Handoff

Requires S1. Produces **candidate-context**, **durable-work**, **candidate-cutover**.

S3 consumes reviewed facts and revision/consent rules. S4 can start alongside S3 after this stage, using preferences and the same worker. S5 consumes compatible approved Career-Ops context without a competing editable profile.

External access: none for local parsers; only selected consented model calls require a provider key. No LinkedIn account is needed for intake.

## What Shipped

Pending. This plan does not import or approve Xavier's private files.

## Deferred To Later Stages

Novel-answer reuse S3; source discovery S4; application lifecycle cutover S5; OCR/new file formats after explicit need; automatic credential intake and private model memory are excluded.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
