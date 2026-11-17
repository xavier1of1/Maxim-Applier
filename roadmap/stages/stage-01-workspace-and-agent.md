# S1: Real workspace and contextual agent

**Status:** Pending implementation. Detailed plan drafted; no acceptance criterion is claimed passed.
**Updated:** 2026-11-16.
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

[Root package](../../package.json) contains MJS/Playwright dependencies and legacy commands; no new web build exists. [Go service](../../dashboard/internal/maxim/service/service.go) remains a native compatibility surface, not the new API or a working command handler.

The proposed default is a single Next.js/React 19 app with shared server services. S0 may select located compatible source instead, but must update paths/test bindings rather than silently building two apps.

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

- [ ] **WSP-01:** Manual job/intent creation persists real IDs, source/JD text and activity; DB/web restart/recreate preserves them and artifact references.
- [ ] **WSP-02:** UI and scripted real agent-tool path read the same record/revision; captured model request includes only authorized bounded data.
- [ ] **WSP-03:** A confirmed note mutation commits entity revision, command result and event atomically; replay is idempotent and changed-payload/stale revision fails.
- [ ] **WSP-04:** Missing session, wrong workspace, expired confirmation, CSRF/origin mismatch and model self-confirmation cannot read/write protected records.
- [ ] **WSP-05:** Backend/model failure, empty data and disconnected streaming are explicit; no mock fallback or false successful action is shown.
- [ ] **WSP-06:** Desktop/mobile and keyboard tests cover navigation, selection, dialogs, tool rendering, readable text and stable layout; unimplemented integrations show truthful disabled/unconfigured state.
- [ ] **WSP-07:** Keys remain server-side; artifact download/path traversal and test/prod DB-root confusion are denied; protected backup restore is exercised.
- [ ] **WSP-08:** Real build/type checks and fixture integration/UI tests pass; actual startup URL, commands, ports, data paths and recovery instructions are documented.

## Integration Test

**Proposed file/command, not available today:** `node --test maxim/app/tests/integration/workspace.test.mjs`.

The test harness boots the actual HTTP/service path against disposable PostgreSQL and a loopback scripted model. Assert tool request/response and DB state, not only final AI prose. Simulate disconnect, duplicate confirmation, crash before commit, stale revision and second identity. Keep private values out of fixtures/traces.

**Proposed UI test:** `maxim/app/tests/e2e/workspace.spec.mjs` using the explicitly declared local Playwright test dependency and fixed desktop/mobile viewports. Run the actual production build in at least one acceptance pass, not only dev rendering.

S1 must create build/typecheck/test commands and isolated harness before any later stage cites them. Model stub proves plumbing; a consented live provider smoke is separate and requires a real key/budget.

## Files Changed

~~~text
maxim/app/package.json                          new app/build/test tooling, pinned by S0
maxim/app/src/app/                              workspace routes and API transports
maxim/app/src/components/                       navigation, job/detail, agent/confirmation
maxim/app/src/server/{auth,commands,jobs,applications,conversations}/
maxim/app/src/server/{db,artifacts,models}/       scoped repositories and adapters
maxim/db/postgres/                              initial migrations
compose.yml                                    proposed DB-only local composition
maxim/app/tests/{support,integration,e2e}/       isolated actual-path harness
docs/maxim/setup.md                             actual new runtime instructions when delivered
~~~
Proposed paths are layout bindings, not existing files. Reuse existing native helpers through explicit ports instead of copying their business logic.

## Dependencies And Handoff

Requires accepted S0 architecture/privacy/baseline outputs. Produces **workspace**, **job-registry**, **application-intent**, **conversation-tools**, **authorization**, **atomic-events**, **artifact-boundary**.

S2 receives an actual onboarding surface/private artifact/command API. S4 later receives job ingestion. S5 receives intents, not a second fully migrated application tracker.

No search, LinkedIn, Gmail or Discord account is needed for this stage. Model-backed acceptance needs only the selected provider; manual records stay usable when unconfigured.

## What Shipped

Pending. No new URL, package command, API endpoint or DB authority is claimed active until implementation evidence is recorded.

## Deferred To Later Stages

Extraction/worker/candidate cutover S2; contextual answer memory S3; discovery S4; evaluation/tracker migration S5; application executor S6; integrations and optional interview lane afterward.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
