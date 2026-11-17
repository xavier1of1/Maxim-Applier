# Detailed Roadmap Stages

**Status:** Revision 0.3. S0 verified for bounded baseline scope; S1-S11 Pending.
**Updated:** 2026-11-16.
**Purpose:** Vantage-style implementation plans for the revised Maxim Apply journey. These files describe work to perform, not work already shipped.

## 1. Start Here

Read [the high-level roadmap](../high-level-roadmap.md), then [shared contracts](contracts.md), then only the next stage's Scope and Acceptance. Use later-stage links to understand handoffs, not as authorization to implement everything in one change.

Each stage includes objective, narrowness axis, thin E2E path, actual code evidence, ordered slices, acceptance case IDs, verification, proposed files, dependencies/handoff, What Shipped and deferrals.

The format follows inspected Vantage files under `E:\10x\10x-vantage\roadmaps`: On-Track operating status, Knowledge conversation checkpoints and MVP agent chat. It borrows their planning discipline, not Rust/Nexus/Enclave dependencies, API names or delivery claims.

> **Comments**
>
> Add corrections or additional requirements here.

## 2. Stage Register

| Stage | User outcome | Mandatory prerequisites | Acceptance cases | Implementation status |
| --- | --- | --- | --- | --- |
| [S0](stage-00-ownership-and-baseline.md) | Ownership, safety, and architecture baseline | None | 6 | Verified |
| [S1](stage-01-workspace-and-agent.md) | Real workspace and contextual agent | S0 | 8 | Pending |
| [S2](stage-02-reviewed-onboarding.md) | Reviewed candidate onboarding | S1 | 8 | Pending |
| [S3](stage-03-answer-memory.md) | Reusable answers and bounded context | S2 | 8 | Pending |
| [S4](stage-04-discovery.md) | Coverage-aware discovery | S2 | 8 | Pending |
| [S5](stage-05-evaluation-and-tracker-cutover.md) | Career-Ops evaluation, packet, and tracker cutover | S3 | 8 | Pending |
| [S6](stage-06-browser-assistance.md) | Supported browser application assistance | S5 | 8 | Pending |
| [S7](stage-07-gmail-evidence.md) | Gmail evidence and response tasks | S5 | 8 | Pending |
| [S8](stage-08-discord-delivery.md) | Durable existing-Discord delivery | S5 | 8 | Pending |
| [S9](stage-09-networking-and-analytics.md) | Networking and outcome insight | S5 | 8 | Pending |
| [S10](stage-10-interview-preparation.md) | Evidence-grounded interview preparation | S5 | 6 | Pending |
| [S11](stage-11-product-acceptance.md) | Product and demonstration acceptance | S6 | 8 | Pending |

The [machine-readable registry](manifest.json) validates identities, dependency cycles, handoff producers/consumers and acceptance-case coverage. It is planning metadata, never runtime application configuration.

Conditional prerequisites are explicit inside each stage and in the registry. S5 only needs S4 for automated-discovery jobs. S8 needs S7 for Gmail-driven alerts, S4 for automated freshness claims, and S9 for networking/manual recruiter reminders. S11 adds optional stages only for capabilities actually claimed.

> **Comments**
>
> Add corrections or additional requirements here.

## 3. Execution Order

**Core assisted-application path:** S0 -> S1 -> S2 -> S3 -> S5 -> S6 -> S11.

**Parallel branches:** after S2, S4 can run alongside S3; after S5, S7/S8/S9/S10 can run alongside S6. Optional practice never blocks application assistance.

S2 introduces the first real durable worker for extraction, which S4-S8 reuse. S1 establishes persistent UI/agent/auth/commands/events without assuming a future scanner or browser.

S11 requires S6 for full assisted-application acceptance. A smaller S0-S3 foundation rehearsal is a useful limited milestone, not a completed application MVP.

> **Comments**
>
> Add corrections or additional requirements here.

## 4. Handoff And Ownership Gates

| Producer | Contract consumed next |
| --- | --- |
| S0 | Actual app/data/writer map, protected recovery method, selected minimal stack/patch decisions |
| S1 | Shared authorized commands/reads, stable job/intents, conversations, atomic events and private artifacts |
| S2 | Reviewed candidate context/projections, candidate cutover and consumed durable work |
| S3 | Scoped approved answers and measured bounded context |
| S4 | Declared coverage/runs/observations for automated discovery consumers |
| S5 | Retained Career-Ops evaluation, approved packet, canonical application/tracker writer |
| S6 | Durable browser review and honest manual-submission evidence |
| S7/S8 | Source-linked mail/tasks and accepted/uncertain delivery, not another tracker |
| S9/S10 | Research-backed manual networking, honest outcome metrics and optional practice |
| S11 | Accepted delivery profile with actually executed evidence |

Candidate-family authority changes at S2; application/tracker authority at S5; contacts/history adaptation at S9. Each switch has a legacy writer freeze/gate, reconciliation, backup and rollback. A PostgreSQL schema alone is not cutover.

Windows-first default is host web/worker/browser with PostgreSQL in loopback Compose. S0 can change it only by updating contracts and tests, not by assuming a container can control a host-visible browser.

> **Comments**
>
> Add corrections or additional requirements here.

## 5. Verification And Status Rules

- Acceptance checkboxes stay unchecked until their actual test ran and evidence is linked.
- The registry supports Pending, In progress, Blocked, Verified and Shipped. Each checked case needs sanitized evidence with caseId, passed result, command, environment, verifiedAt and an existing repository-local record; Verified/Shipped requires every case. The checker validates references, not the truth of a claimed execution.
- Existing paths/commands are labeled separately from proposed files/tests. Future integration commands are specifications for tests to implement, not currently working scripts.
- S1 creates a real isolated HTTP/DB/model/UI harness. Product tests live under `maxim/app/tests/` so legacy `maxim:test` does not accidentally launch them.
- Dedicated disposable test credentials/storage only. The harness refuses production DB/private-data roots before setup/cleanup; no .env fallback.
- Fixture providers/models/forms prove contract behavior, not real-site support or model quality. Live smokes require explicit scope/consent and separate evidence.
- EGM drift reporting is a same-context code/design audit, not the full independent review loop or convergence.
- No roadmap/stage IDs in product UI/API/config/logs; name the capability. Planning/test metadata may use these IDs.

**Planning checks available now:**
~~~powershell
node roadmap/validate-roadmap.mjs
node --test roadmap/validate-roadmap.test.mjs
~~~
These validate documents/graph/handoffs, not future product functionality.

> **Comments**
>
> Add corrections or additional requirements here.

## 6. Known Baseline Defects And Stage Owners

| Finding | Owner and acceptance coverage |
| --- | --- |
| Unapproved fallback resume can be offered; legacy tests conflict | S5 APP-03, S6 BRW-02 |
| Source-audit help reads --help as a file | S4 DSC-01 |
| Discord records a fingerprint before successful HTTP acceptance | S8 NTF-02/03 |
| Go decision handler returns nil without writing | S5 APP-06 |
| Separate SQLite calls and JSONL append are not an atomic mutation/event transaction | S1 WSP-03; S2 ONB-03; S5 APP-06 |
| Fuzzy company/title matching can combine distinct job IDs | S4 DSC-02, S5 APP-04 |
| Metrics denominator includes compatible evaluated records, not only confirmed submitted attempts | S9 NET-06 |
| Null/out-of-range score can be assigned a normal tier | S5 APP-01 |

These are not fixed by writing a plan. See [drift report](../reviews/2026-11-16_DRIFT_REPORT.md) and [refinement/validation record](../reviews/roadmap-refinement.md).

> **Comments**
>
> Add corrections or additional requirements here.

## 7. Detailed Decisions Without Reopening Accepted Direction

Already accepted: early useful dashboard/agent, PostgreSQL/private artifacts/Compose target, reviewed onboarding, selective Career-Ops retention and existing Discord reuse.

S0/S1 still must pin actual versions, framework/source reuse, provider/model/counter, local sessions, paths/backup protection and configuration. Each stage lists only its genuinely required accounts/setup; no optional library or account blocks the core path.

Dossier remains a design/provider-contract reference by default; copying source is AGPL-gated. Astryx/agent-browser are candidates with compatibility/support tests, not preinstalled product infrastructure.

> **Comments**
>
> Add corrections or additional requirements here.

## 8. Recording Delivery

When implementation actually passes, update the stage's What Shipped with exact files/commits if any, commands/date/environment, individual case evidence, migration/restore results, limitations and deferred findings. Update the registry/status/index consistently.

A plan review cannot mark an implementation stage Shipped. A failing producing-stage proof blocks its consumers even if a similar legacy module exists.

> **Comments**
>
> Add corrections or additional requirements here.

## 9. Miscellaneous Additions

Add a desired user outcome, producing stage, consumed contract, costs/privacy and acceptance test for each new idea. Update the registry and relevant dependent stages, not just a miscellaneous bullet.

> **Comments**
>
> Add corrections or additional requirements here.
