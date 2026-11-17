# S5: Career-Ops evaluation, packet, and tracker cutover

**Status:** Verified for the bounded S5 scope. APP-01 through APP-08 passed; no production data cutover or browser executor is implied.
**Updated:** 2026-11-17.
**Roadmap:** [Stage index](README.md) | [High-level roadmap](../high-level-roadmap.md) | [Shared contracts](contracts.md)
**Requires:** [S3](stage-03-answer-memory.md)

> **How to pick this up:** Implement only this file's Scope and Acceptance, in the ordered slices below. Existing paths are evidence, not a promise of compatible behavior. Proposed files/tests do not exist until implemented. Dependencies require their own recorded proof; planning status never satisfies them.

## Objective

Use the retained Career-Ops evaluator and packet generators through one application lifecycle, then prove safe tracker cutover and retirement of the rejected runner.

## Thin Vertical Slice

- **Narrowness axis:** one manually added or discovered opening, one approved candidate context, one retained evaluation, one approved PDF/report pair and one canonical application.
- **E2E path:** ask agent to evaluate; inspect same score/tier and flags in UI; approve a packet; reconcile/import a legacy fixture; switch supported writers; record a reviewed status and restart; all readers agree.
- **Counterexample:** another opening with the same company/title, malformed report or obsolete attachment cannot overwrite this application.
- **Outside this slice:** universal browser support, a scoring rewrite, mandatory multi-agent resume review, autonomous submission.

## Current Evidence And Boundary

[Evaluation wrapper](../../maxim/scripts/evaluate-job.mjs) is now a narrow canonical API adapter. The former Gemini/newest-mtime/TSV/merge/sync chain is retired. Invocation-bound durable work uses the retained shared Career-Ops prompt/modes and generator.

[Tracker sync](../../maxim/lib/tracker-sync.mjs) uses a hash-checked offline projection after cutover, not another writable SQLite tracker. Legacy tracker helpers remain gated. The canonical service uses exact opening IDs and attributable warnings; the [Go service](../../dashboard/internal/maxim/service/service.go) explicitly rejects unsupported decision writes rather than returning successful no-ops.

Preserve native [PDF generation](../../generate-pdf.mjs), scoring/modes and report semantics. A selected model transport does not permit silently changing Career-Ops scoring behavior.

## Scope And Contracts

- Add one evaluation/packet service contract and invocation-specific work directory/job ID, not newest-file-by-mtime selection. Bound fetch/subprocess inputs, time/output and profile projection access.
- Snapshot approved candidate/JD/context/policy/provider/model revisions; parse/validate the retained score/explanation/report. Mark liveness unconfirmed honestly where native batch behavior does.
- Keep T0/T1/T2/T3 routing and eligibility/priority/readiness separate. T1 requires a recorded strategic override; high fit does not authorize missing facts or final submission.
- Track packet metadata/hash/approval and invalidate stale dependent material. A configured fallback file is not approved merely because it exists. An explicitly approved untailored resume can be attached with warning; contradictory legacy fallback tests must reflect this consent rule.
- Optional Hiring Panel: user-triggered, scoped budget/cache, evidence-grounded findings and editable diffs. It must not overwrite facts, mint a competing fit score, or put placeholders into PDFs.
- Reconcile native Markdown, SQLite, JSONL, history and artifact links with stable source-key maps, raw statuses and conflict review. Preserve existing S1 intent IDs.
- Stage candidate/application ownership changes separately. Freeze legacy writes for application cutover; compare totals/IDs/status/evaluation/artifact histories; activate canonical commands/projections in one controlled release.
- Patch or gate native merge/direct writes, supported CLI modes and Go decision path. Never acknowledge a no-op as a successful decision. Offline native clients may read a labeled projection; offline writes fail rather than silently diverge.
- Retire rejected planner/mapper/runner navigation registrations/imports/docs once data and compatible consumers are preserved. Retain useful fixtures as replacement safety requirements and native Playwright PDF/liveness.

## Ordered Implementation Slices

| Slice | Action | Proof |
| --- | --- | --- |
| APP-A | Lifecycle/identity/duplicate/readiness contract | Distinct opening IDs; manual declarations separate from packet state |
| APP-B | Isolated retained evaluator adapter + invocation-bound artifacts | One job cannot select another concurrent report/PDF |
| APP-C | Packet approval, source/score snapshots, optional critique | Exact approved artifact, no unapproved fallback or fabricated claim |
| APP-D | Lossless staged import + projection/writer adapters | Mapping/conflict report and rollback before owner switch |
| APP-E | Controlled cutover + rejected entry-point retirement | One active writer and native regression proof |

## Acceptance

- [x] **APP-01:** Retained Career-Ops score/explanation drives tiers with threshold, policy, override and absent/invalid-score tests; no alternative fit score exists.
- [x] **APP-02:** Concurrent/retried evaluations link only their own invocation outputs; command replay and malformed reports cannot duplicate or delete unrelated artifacts.
- [x] **APP-03:** Packet approval binds current facts/JD/report/PDF hashes; stale, placeholder, fabricated or unapproved fallback material is withheld.
- [x] **APP-04:** Duplicate/reapply handling respects company/role/URL/source job IDs and preserves distinct openings; any merge or reviewed reapplication is attributable.
- [x] **APP-05:** Staged legacy import preserves raw fields, stable IDs, status/evaluation-at-action, history and artifacts; conflicts are reviewed and repeat import is idempotent.
- [x] **APP-06:** Freeze/switch/rollback covers all supported native/Maxim/Go writers and projections; no acknowledged edit is lost and no no-op returns success.
- [x] **APP-07:** Rejected runner entry points and stale recommendations are inactive, while retained scoring/PDF/liveness/native read behavior passes bounded regressions.
- [x] **APP-08:** UI/agent/native compatibility reads agree after restart; prepared/reviewed/filled/submitted/outcome remain distinct, including legitimate manually recorded external submissions.

## Integration Test

**Existing regression references:** `maxim/tests/integration/sync-store.test.mjs`, `application-tracker-store.test.mjs` and unit tier/policy/parser/safety tests. Run in their fixture scope; passing old tests is not PostgreSQL cutover evidence.

**Implemented:** `npm run maxim:workspace:test` runs strict Rust/unit checks, real PostgreSQL worker/invocation/packet/cutover/restore tests and `maxim/app/tests/e2e/application-packet.spec.mjs` in desktop/mobile Chromium.

Use S1-S3 harness plus two concurrent evaluations, two similar company-role openings with different IDs, a malformed result, stale approval, failed migration phase and restore. Perform a real retained local PDF fixture. Script model responses for deterministic score contract tests; live evaluation quality review is separately recorded.

Restore tests use a disposable environment, never a destructive rollback on the user's live DB.

## Files Changed

~~~text
maxim/app/src/server/{evaluations,packets,applications,legacy}/
maxim/app/src/worker/{evaluation,packet,projection}.ts
maxim/app/src/app/                              scored application/packet/reconciliation views
maxim/db/postgres/                              evaluations, packet versions, migrations/mapping
maxim/app/tests/{integration,e2e,fixtures}/
maxim/scripts/evaluate-job.mjs                  narrow adapter or gate old pipeline
merge-tracker.mjs, relevant modes/CLI scripts   explicit native write gates/adapters
dashboard/internal/maxim/service/service.go     real command/rejection, not nil no-op
AGENTS.md, CLAUDE.md, DATA_CONTRACT.md           implemented ownership/command guidance
package.json                                   retire rejected registrations after proof
~~~
Exact native patch/removal set comes from S0 inventory. No generic delete of all non-Career-Ops code or private imports.

## Dependencies And Handoff

Requires S3; S4 is conditional on automated discovery, not required for manually added roles. Produces **careerops-evaluation**, **approved-packet**, **canonical-applications**, **tracker-cutover**.

S6 gets one ID, approved artifacts, scoped answers and command API. S7-S10 can work independently on the same lifecycle. Do not invent a permanent user sync step.

## What Shipped

See [case evidence](../reviews/s5-evaluation-and-cutover.md) and the
[operator/compatibility guide](../../docs/maxim/application-lifecycle.md).

Shipped schema 006, retained evaluation and native PDF adapters, Rust report/GFM
validation, exact fact/answer/report/PDF approval, policy/override and duplicate
guards, distinct manual workflow/outcomes, shared UI/agent/CLI reads, raw legacy
reconciliation, controlled family cutover and native/Go write gates/read projections.
Recovery preserves acknowledged edits; rollback and backup v3 retain latest state,
unrelated SQLite families and application/candidate journals.

The rejected planner/mapper/browser executor, imports and package registrations
are retired. Useful safety scenarios and private historical run reports survive;
obsolete guides are explicitly archived. Candidate/application production ownership
is never activated automatically by startup or tests.

## Deferred To Later Stages

Browser controls/session/handoff S6; live Gmail S7; Discord S8; contact/history feature adaptation and analytics S9; full resume panel optional and not a cutover prerequisite.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
