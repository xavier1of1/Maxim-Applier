# S0: Ownership, safety, and architecture baseline

**Status:** Verified for the bounded S0 foundation scope. See [executed evidence](../reviews/s0-baseline.md); no stack or cutover is claimed.
**Updated:** 2026-11-16.
**Roadmap:** [Stage index](README.md) | [High-level roadmap](../high-level-roadmap.md) | [Shared contracts](contracts.md)
**Requires:** No prior implementation stage; accepted direction and protected audit access.

> **How to pick this up:** Implement only this file's Scope and Acceptance, in the ordered slices below. Existing paths are evidence, not a promise of compatible behavior. Proposed files/tests do not exist until implemented. Dependencies require their own recorded proof; planning status never satisfies them.

## Objective

Establish a recoverable baseline, choose the minimal stack, and make every ownership/retirement change explicit before writing a new runtime.

## Thin Vertical Slice

- **Narrowness axis:** one existing candidate/application/artifact path, one protected synthetic restore, one architecture/patch inventory.
- **E2E path:** inventory current files and writers; trace a fixture evaluation/PDF/tracker record; preserve raw source and IDs; restore into an isolated target; document the selected S1 composition and unresolved gates.
- **User outcome:** the next implementation has a known owner/path for data and no surprise migration or hidden second stack.
- **Outside this slice:** new dashboard, production migration, automatic upstream update, broad deletions, new account registration.

## Current Evidence And Boundary

[package.json](../../package.json) has native/Maxim MJS commands, not a web product workspace. [DATA_CONTRACT.md](../../DATA_CONTRACT.md) still owns user files. [SQLiteMaximStore](../../maxim/lib/sqlite-store.mjs) shells to Python per operation; [EventLog](../../maxim/lib/event-log.mjs) appends JSONL separately. These are not an atomic canonical store.

[Go DashboardService](../../dashboard/internal/maxim/service/service.go) reads tracker/snapshot data; RecordDecision is a no-op returning nil. Do not treat that method as proof of a working write path.

The current fork inventory has no separate React/API package or Compose file. This says nothing about other machines/repos. Perform a bounded search of known locations, then record unlocated source rather than blocking indefinitely.

## Scope

- Inventory native capabilities, useful Maxim extensions, rejected runner entry points, private stores/artifacts, scanners, direct file writers and tests.
- Inspect tracked paths/history/build context privacy locally; do not dump candidate contents or secrets into a report. Ignore rules do not prove no historical exposure.
- Freeze the proposed binding in shared contracts or replace it explicitly: one app/service boundary, PostgreSQL/private bytes, host web/worker plus DB Compose for Windows, model adapter and supported counter.
- Pin dependencies only after compatibility/license checks. Default to independently implementing Dossier-inspired behavior. Astryx/agent-browser remain stage spikes; Hermes/Graphify runtime do not block.
- Specify protected data/backup paths, access and retention decisions; document recovery for DB plus linked bytes and future browser secrets.
- Define native upstream patch/update review and entity-family cutovers, including candidate writes in AGENTS/CLAUDE/modes and application writes in TSV/merge/dashboard/CLI paths.
- Classify current test failures with owner, blocking scope and disposition. Rejected implementation tests may become replacement safety scenarios, not vanish to produce a green count.

## Ordered Implementation Slices

| Slice | Action | Result and proof |
| --- | --- | --- |
| OWN-A | Metadata/source inventory and narrow command audit | Repository/app/authority map, no raw personal content |
| OWN-B | Protected backup + restore fixture | Counts, IDs, raw hashes and artifact links match; production paths refused |
| OWN-C | Stack, runtime, local access, storage and source-reuse decisions | Small decision records with explicit alternatives and S1 bindings |
| OWN-D | Writer/retirement/patch inventory | Every active route classified retained, adapted, gated or retired at a named cutover |
| OWN-E | Reproduce safe baseline checks | Sanitized results with command/environment and failure owner |

A full `test-all.mjs` run invokes normalize/dedup/merge and must not run against real user data during planning. Use a fixture checkout/root after inspecting path binding, or limit this phase to read-only/fixture tests and record the exclusion.

## Acceptance

- [x] **OWN-01:** A source/writer map includes CV/profile, native tracker, SQLite/events, artifacts, Go reads/writes, evaluator and rejected runner; unlocated web source is labeled after a bounded search.
- [x] **OWN-02:** A restore to a new isolated fixture target preserves raw-field/hash/ID/artifact relationships; the restore tool refuses production/ancestor paths and protected backups exist before real cutover.
- [x] **OWN-03:** S1 runtime/layout/model adapter/local session/storage decisions and license policy are recorded with version-resolution steps, not undocumented assumptions.
- [x] **OWN-04:** Each native writer/consumer and retired runner reference has an owner, patch/gate, regression test and rollback/retirement condition.
- [x] **OWN-05:** Privacy checks cover tracked/ignored/history/build/export risk without publishing findings or secret values; remediation requiring rotation/history changes is a separate approved action.
- [x] **OWN-06:** Baseline results are reproducible and failures are explicitly assigned; no checked future product criteria, live-site support or complete discovery claim follows from fixtures.

## Integration Test

**Existing safe commands:** Unit files via Node's test runner, `node maxim/scripts/website-safety-check.mjs`, and `go test ./...` from dashboard. Inspect tests before running; use isolated Temp fixtures and a mock webhook, never a real notification.

**Proposed test to implement:** `node --test maxim/app/tests/integration/baseline-restore.test.mjs`. If S1's product harness is not present yet, use a small fixture-only restore test under the existing native test convention and have S1 consume it rather than inventing a DB prerequisite for S0.

This proof must test target-path validation, missing artifact, corrupt backup, idempotent import mapping and no production writes. A metadata-only backup checklist is not a restore test.

## Files Changed

**Existing to inspect/patch narrowly:** `AGENTS.md`, `CLAUDE.md`, `DATA_CONTRACT.md`, `package.json`, native modes/trackers/providers, Maxim libraries/scripts, Go dashboard service.

**Proposed deliverables:**
~~~text
docs/maxim/decisions/               architecture/local-access/storage/compatibility records
roadmap/reviews/                   sanitized baseline and drift evidence
maxim/scripts/                    protected backup/restore or fixture baseline tooling
maxim/app/tests/integration/       baseline-restore proof when product harness exists
~~~
No deletion manifest is executed solely because this file exists.

## Dependencies And Handoff

Produces **baseline** and **architecture**. S1 receives concrete app/runtime/storage/local-access bindings, a native capability map and known failure list. S2/S5 receive writer/cutover inventories; not a generic instruction to keep all old writes forever.

No personal API key is required to complete documentation/audit/fixture work. Real model/provider access is a later acceptance dependency only when a live capability is claimed.

## What Shipped

Implemented guarded backup/restore library and CLI, six passing recovery tests, an ACL-protected 137-file real snapshot/restore, architecture ADR 0005, source/writer/patch inventory and bounded privacy/baseline audit. Evidence is in s0-baseline.md. Existing application defects are assigned, not fixed; historical privacy review is bounded, not certified clean.

## Deferred To Later Stages

Candidate import S2; one tracker and runner retirement S5; site executor S6; provider/Gmail/Discord setup at their stages; destructive history cleanup or secret rotation only through an approved protected procedure.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
