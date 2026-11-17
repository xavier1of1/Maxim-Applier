# S1: Real workspace and contextual agent

**Status:** Verified. All eight acceptance cases passed; [execution evidence](../reviews/s1-workspace.md).
**Updated:** 2026-11-17.
**Roadmap:** [Stage index](README.md) | [High-level roadmap](../high-level-roadmap.md) | [Shared contracts](contracts.md)
**Requires:** [S0](stage-00-ownership-and-baseline.md)

> **How to pick this up:** Implement only this file's Scope and Acceptance, in the ordered slices below. Existing paths are evidence, not a promise of compatible behavior. Proposed files/tests do not exist until implemented. Dependencies require their own recorded proof; planning status never satisfies them.

## Objective

Deliver a useful real dashboard and contextual agent over a minimal persistent application foundation, before discovery or browser assistance.

## Thin Vertical Slice

- **Narrowness axis:** one local workspace, manually entered posting, application intent, read-only agent tools and one confirmed mutation.
- **E2E path:** user signs into the local workspace, adds company/title/JD text, creates an intent, asks the agent about it, confirms a note change, restarts web/DB, and sees the same ID/revision and activity.
- **Counterexample:** a second fixture identity, stale confirmation or failed backend cannot read/mutate the record or receive sample replacements.
- **Outside this slice:** job search, resume parsing, full application migration, packet generation, browser automation.

## Current Evidence And Boundary

[Root package](../../package.json) retains native commands and adds namespaced workspace commands. The actual [app](../../maxim/app/package.json) builds Next.js/React/Astryx. [Go service](../../dashboard/internal/maxim/service/service.go) remains a native compatibility surface, not the new API or a working command handler.

The selected binding is one Next.js/React 19 app with scoped shared server services, PostgreSQL and protected private references. See [ADR 0006](../../docs/maxim/decisions/0006-workspace-implementation.md) and [operating guide](../../docs/maxim/workspace.md).

## Scope And Contracts

- Create the product workspace and real DB migrations for workspace/candidate identity, jobs/aliases, application intents, revisions, conversations/messages, commands/confirmations, domain events and artifact metadata.
- Host web on Windows initially, PostgreSQL in loopback-only Compose; protected private artifact root; no DB/public build-context leakage. Document exact startup/stop/restart and backup commands once implemented.
- Implement local bootstrap/session auth, origin/CSRF protections, server-held provider credentials and workspace isolation. This is single-user local operation, not enterprise RBAC.
- Define read tools for jobs/applications/activity and a proposal-confirmation path for one simple note change. Shared services own logic; model tools have no arbitrary SQL/shell/file access.
- Save complete message/tool ordering and error/cancel state. Conversation text is not candidate truth; context budget and output reserve exist from the first model call, with S3 extending retrieval.
- UI: real jobs list/detail, application-intent view, activity, contextual agent and integration/setup status. Match selected record across navigation/refresh. Use modest operational hierarchy, accessible controls and responsive layout.
- Validate Astryx build/React/CSS/focus/dialog/table/chat compatibility, or record one alternative. Independent Dossier-inspired workflow is the default; no AGPL component copying.
- Establish an isolated fixture HTTP/DB/model/UI test harness outside the legacy recursive test tree. No test may use .env/production DB credentials as fallback.

S1 does not implement extraction or a generic unused worker. S2 introduces durable work with its first real consumer. S1 does provide transactional events and an outbox record contract to avoid retrofitting mutation atomicity later.

## Ordered Implementation Slices

| Slice | Action | Observable result |
| --- | --- | --- |
| WSP-A | App/config/migrations/private roots + dedicated test DB harness | Restart/restore round trip, no production path fallback |
| WSP-B | Local session/scope and transaction/idempotency service | Same authenticated command used by HTTP and tools |
| WSP-C | Real manual posting/intent UI | Useful records without model key or search provider |
| WSP-D | Bounded model adapter + read tools + conversation persistence | Agent answers from actual fixture DB, not seeded canned prose |
| WSP-E | Explicit proposal/confirmation for one mutation | Human confirms, current authority/revision rechecked, event commits once |
| WSP-F | UI polish/error/recovery and instructions | Actual URL and start/stop commands, keyboard/mobile/empty/error proof |

## Acceptance

- [x] **WSP-01:** Manual job/intent creation persists real IDs, source/JD text and activity; DB/web restart/recreate preserves them and artifact references.
- [x] **WSP-02:** UI and scripted real agent-tool path read the same record/revision; captured model request includes only authorized bounded data.
- [x] **WSP-03:** A confirmed note mutation commits entity revision, command result and event atomically; replay is idempotent and changed-payload/stale revision fails.
- [x] **WSP-04:** Missing session, wrong workspace, expired confirmation, CSRF/origin mismatch and model self-confirmation cannot read/write protected records.
- [x] **WSP-05:** Backend/model failure, empty data and disconnected streaming are explicit; no mock fallback or false successful action is shown.
- [x] **WSP-06:** Desktop/mobile and keyboard tests cover navigation, selection, dialogs, tool rendering, readable text and stable layout; unimplemented integrations show truthful disabled/unconfigured state.
- [x] **WSP-07:** Keys remain server-side; artifact download/path traversal and test/prod DB-root confusion are denied; protected backup restore is exercised.
- [x] **WSP-08:** Real build/type checks and fixture integration/UI tests pass; actual startup URL, commands, ports, data paths and recovery instructions are documented.

## Integration Test

**Implemented command:** `npm --prefix maxim/app test` runs typecheck/build/integration/browser checks. The [integration suite](../../maxim/app/tests/integration/workspace.test.mjs) boots the actual production server.

The test harness boots the actual HTTP/service path against disposable PostgreSQL and a loopback scripted model. Assert tool request/response and DB state, not only final AI prose. Simulate disconnect, duplicate confirmation, crash before commit, stale revision and second identity. Keep private values out of fixtures/traces.

**Implemented UI test:** [workspace.spec.mjs](../../maxim/app/tests/e2e/workspace.spec.mjs) uses pinned Playwright Chromium against production, with desktop/tablet/mobile and keyboard checks.

S1 must create build/typecheck/test commands and isolated harness before any later stage cites them. Model stub proves plumbing; a consented live provider smoke is separate and requires a real key/budget.

## Files Changed

~~~text
maxim/app/package.json                          new app/build/test tooling, pinned by S0
maxim/app/src/app/                              workspace routes and API transports
maxim/app/src/components/                       navigation, job/detail, agent/confirmation
maxim/app/src/server/{auth,commands,reads,conversations}.ts
maxim/app/src/server/{db,artifacts,models,config,http,errors}.ts
maxim/db/postgres/                              initial migrations
compose.yml                                    proposed DB-only local composition
maxim/app/tests/{support,integration,e2e}/       isolated actual-path harness
docs/maxim/setup.md                             actual new runtime instructions when delivered
~~~
The flat server modules implement the bindings above; no native evaluator/tracker business logic is copied. Runtime scripts and the exact package lock also live under maxim/app.

## Dependencies And Handoff

Requires accepted S0 architecture/privacy/baseline outputs. Produces **workspace**, **job-registry**, **application-intent**, **conversation-tools**, **authorization**, **atomic-events**, **artifact-boundary**.

S2 receives an actual onboarding surface/private artifact/command API. S4 later receives job ingestion. S5 receives intents, not a second fully migrated application tracker.

No search, LinkedIn, Gmail or Discord account is needed for this stage. Model-backed acceptance needs only the selected provider; manual records stay usable when unconfigured.

## What Shipped

The real authenticated local workspace ships manual roles, intents, notes, activity, private references, streaming saved conversations and explicit human note confirmation. Astryx supplies the UI foundation. Preferred URL: http://127.0.0.1:3010/maxim; `npm run maxim:workspace` prints the actual port.

All acceptance cases are linked in the [execution record](../reviews/s1-workspace.md). The live provider remains user-configured; fixtures do not imply live account access. Legacy candidate/tracker authority is untouched. Recovery verifies a separate database/files rather than silently promoting it. Conservative byte budgeting is not exact model-specific token counting.

## Deferred To Later Stages

Extraction/worker/candidate cutover S2; contextual answer memory S3; discovery S4; evaluation/tracker migration S5; application executor S6; integrations and optional interview lane afterward.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
