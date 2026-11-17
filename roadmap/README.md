# Maxim Apply Roadmap Index

**Status:** Revision 0.3. Refined roadmap with detailed stage specifications; implementation remains Pending.
**Updated:** 2026-11-16.
**Demo target:** 2026-11-19. No claim that this entire roadmap fits before that date.

## 1. Direction And Authority

Build one private-data, conversational application workspace on the retained Career-Ops engine. Put a useful dashboard and agent interface near the beginning so onboarding and each later capability can be evaluated through the actual user journey.

One candidate knowledge authority, one application lifecycle, and shared commands across UI, agent, and supported CLI paths. The browser prepares supported forms and stops for user review and manual submission. Frictionless does not mean unattended mass applications.

The latest accepted directions supersede older SQLite-sidecar-only and Go-dashboard-only target constraints. They do not authorize replacing Career-Ops scoring, PDFs, useful scanners, or deleting user data. PostgreSQL and a web experience are target changes with explicit migration gates, not capabilities this documentation ships.

The refinement adds detailed stage plans, a code/design drift report and executable roadmap checks. EGM was installed in the preceding pass. No product stack, migration, runner retirement or other candidate runtime dependency is installed by this documentation task.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 2. Reading Order

| Document | Read it for | Standing |
| --- | --- | --- |
| [System manifesto](MANIFESTO.md) | Product journey, authority, memory, architecture, boundaries | Revised target proposal with accepted decisions marked |
| [High-level roadmap](high-level-roadmap.md) | Refined early UI stages, dependencies and optional lanes | All implementation stages Pending |
| [Detailed stage plans](stages/README.md) | Twelve Vantage-style implementation plans with 92 acceptance cases | Drafted, not implemented |
| [Shared stage contracts](stages/contracts.md) | Runtime binding, commands, identity, storage, worker and consumer contracts | Proposed implementation detail with S0 gates |
| [Refinement and validation](reviews/roadmap-refinement.md) | Changes, executed tests, remaining runtime gaps | Actual evidence scope recorded |
| [External component assessment](external-components-assessment.md) | All ten suggestions, deep Dossier review, licensing, adoption gates | Primary-source research, not a benchmark or integration claim |
| [Operational setup and inputs](operational-setup.md) | Accounts, dependencies, private data, proposed settings, setup order | Checklist; distinguishes existing from planned configuration |
| [Development workflow](development-workflow.md) | Installed EGM plugin and review/implementation discipline | Development instructions; formal review still requires its human gates |
| [Original workflow and comments](current-system-workflow.md) | Current-system explanation and Xavier's unfinished annotations | Preserved without editing |
| [Data contract](../DATA_CONTRACT.md) | Existing user/system separation | Current contract until an approved cutover changes specific ownership |
| [Implementation status](../docs/maxim/implementation_status.md) | Prior implementation and verification record | Historical baseline plus planning handoff |
| [Earlier redesign v2.1](../docs/V2%20Redesign/maxim_apply_career_ops_redesign_v2_1.md) | Retained Career-Ops doctrine and earlier requirements | Applies where not changed by latest explicit directions |
| [Earlier roadmap v1.1](../docs/V2%20Redesign/maxim_apply_career_ops_implementation_roadmap_v1_1.md) | Previous fork phases and compatibility expectations | Not this roadmap's stage numbering |

The Vantage reference supplies a planning style: objective, scope, thin end-to-end proof, dependencies, failure cases, and evidence. It does not require Vantage code or its runtime.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 3. Latest Review: What Is Accepted

The latest numbered reply answers the earlier eight decision groups. It does not approve every package listed afterward.

| Group | Confirmed direction | Still to detail |
| --- | --- | --- |
| 1. Journey/demo | Early dashboard and agent; visible supported browser workflow; recruiter/FDE demonstration | Exact timed script and included live integrations |
| 2. Storage | PostgreSQL, private artifact storage, local Compose composition | Host paths, versions, backup/restore commands, migration mapping |
| 3. Onboarding | Upload and review; PDF, DOCX, Markdown, text starting scope | Limits, extraction fixtures, redaction/consent UX, parser choices |
| 4. Runtime | Reconsider the agent using the new references; one shared service/tool boundary | Framework/provider/model, Vantage reuse, exact token counter |
| 5. Knowledge | Confirm facts, reuse approved answers, bounded context, correction/retention controls | Detailed schema, sensitivity policy, budgets and retention durations |
| 6. Compatibility | Selective Career-Ops reuse and deliberate retirement, documented clearly | Exact patch inventory and ownership cutover |
| 7. Browser | Begin with a narrow supported path; broaden to company sites, LinkedIn, Workday and other sites | Per-site permission, session custody, adapter proof, remote mode |
| 8. Integrations | Reuse the existing Discord named maxim applier | Destination ID/webhook reference, scheduler, Gmail consent, glasses feasibility |

Blank comments in the original workflow remain unanswered. No candidate claims or secrets are inferred from these approvals.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 4. High-Level Sequence

| ID | Outcome visible to the user | Dependency | Status |
| --- | --- | --- | --- |
| S0 | [A reliable ownership/privacy baseline and approved minimal architecture](stages/stage-00-ownership-and-baseline.md) | Accepted direction; bounded audit | Pending |
| S1 | [A real baseline dashboard and agent over persistent jobs/applications](stages/stage-01-workspace-and-agent.md) | S0 | Pending |
| S2 | [Upload, review, correct, and retain personal knowledge](stages/stage-02-reviewed-onboarding.md) | S1 | Pending |
| S3 | [Answer once; recall safely through UI and agent](stages/stage-03-answer-memory.md) | S2 | Pending |
| S4 | [Search/scan jobs with visible coverage and provider failures](stages/stage-04-discovery.md) | S2 | Pending |
| S5 | [Career-Ops evaluation, approved packet, one tracker after proven cutover](stages/stage-05-evaluation-and-tracker-cutover.md) | S3; S4 only for automated-discovery jobs | Pending |
| S6 | [Fill a supported form, ask unknowns, pause/resume, hand off for manual submission](stages/stage-06-browser-assistance.md) | S5 and browser design gate | Pending |
| S7 | [Read job-related Gmail evidence and review uncertain matches](stages/stage-07-gmail-evidence.md) | S5 | Pending |
| S8 | [Reliable notifications to the existing Discord](stages/stage-08-discord-delivery.md) | S5; S4 automated freshness; S7 Gmail; S9 networking/manual recruiter | Pending |
| S9 | [Store-backed networking and honest outcome analytics in the same workspace](stages/stage-09-networking-and-analytics.md) | S5 (includes S3) | Pending |
| S10 | [Optional interview practice grounded in the candidate's real evidence](stages/stage-10-interview-preparation.md) | S5 (includes S3); optional | Pending |
| S11 | [Rehearsed acceptance of the explicitly selected delivery slice](stages/stage-11-product-acceptance.md) | S6 plus claimed optional stages | Pending |

Core path: S0 -> S1 -> S2 -> S3 -> S5 -> S6 -> S11. S2 creates the consumed durable worker; S4 follows S2 but does not block manual job intake/evaluation. S11 requires supported browser assistance, not just foundation screens.

The old draft put the dashboard at S7. This revision moves it to S1 and onboarding to S2. IDs are local planning identifiers, not claims that old similarly numbered implementation phases passed.

S1 is not a mock shell: it persists a manually added job and application, exposes that same ID through chat, survives restart, and shows genuine failure/empty states. It does not need later scanning or browser automation to be useful.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 5. External Components: Recommended Disposition

| Suggestion | Decision/recommendation | Where |
| --- | --- | --- |
| Microsoft Tokenizer | Conditional local token counter behind a model-specific adapter; unsupported models must not be silently miscounted | S1 budget instrumentation, S3 validated accounting |
| Meta Astryx | Preferred design-system candidate, subject to React 19/accessibility/build spike; use one component foundation | S1 |
| Cracked Skills | Adapt selected project-defense, behavioral, system-design, company-prep workflows; not all skills or a second profile store | S10 |
| Dossier | Strong UX and provider-contract reference; independent implementation by default; source copying requires an AGPL licensing decision | S1, S2, S4, S5, S7 |
| Hiring Panel | Optional, budgeted resume critique with approved diffs; no second fit score | S5 |
| LinkedIn connector | Connection-export import may help; no job search, application, inbox, or live people-search capability established | S9 |
| Graphify | Optional source-only development analysis; not candidate truth or a runtime dependency | S0 and later engineering work |
| Hermes | Excluded from MVP; no identified necessary gap or specific project selected | Revisit only with a concrete need |
| Elephant/Goldfish | Full Codex plugin installed; apply its explicit context and human approval discipline | Throughout development |
| agent-browser | Preferred browser-executor candidate for a bounded spike, not an adopted universal auto-applier | S6 |

No optional dependency blocks S1 merely because it is interesting. Adoption requires a demonstrable user benefit, pinned dependency/license review, and a failure/recovery test. See the [assessment](external-components-assessment.md) for evidence and alternatives.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 6. Important Boundaries

- Career-Ops remains the sole 1.0-5.0 job-fit evaluation authority. T0 below 3.5, T1 3.5 to below 4.0, T2 4.0 to below 4.5, T3 4.5 and above. Networking and top-20-percent attention are overlays.
- Native PDF/report generation, useful scanning, and liveness behavior are retained. The rejected Maxim application runner is not the replacement foundation.
- The new web/agent workspace is one interface over the fork's shared services, not Dossier running beside another CRM.
- PostgreSQL is the accepted target, but existing SQLite/files remain current until entity-level migration/cutover is proved. No permanent two-way sync or competing active trackers.
- User review and manual final submission remain required. No LinkedIn message sending, hidden platform automation, CAPTCHA bypass, stealth/evasion plugins, or fabricated claims.
- Candidate facts and job requirements are separate authorities. A job description mentioning a tool never proves the candidate used it.
- Candidate sources, contacts, mail, prompts/traces, sessions, DBs, and backups stay private and out of Git, public builds, and screen-share fixtures.
- Dossier source is AGPL-3.0. No source was copied and this repository was not relicensed. Shared ideas are not blanket permission to transplant its implementation.
- Only EGM was installed. Product/runtime candidates remain proposals until their stage gates pass.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 7. Evidence And Current Limitations

Fresh safe baseline on 2026-11-16: **53/55 unit tests passed**, with fallback-resume approval and source-audit help failing. The isolated Discord retry fixture also failed after permitted fixture access, reproducing premature notification suppression. **Go dashboard tests and the static safety check passed.**

Additional code gaps: SQLite/JSONL operations are not one atomic mutation/event transaction; Go RecordDecision is a no-op; fuzzy job matching can collapse openings; metrics use compatible records rather than confirmed submitted attempts; null/invalid score coercion can produce a normal tier. They have explicit stage owners and tests in the [drift/validation record](reviews/roadmap-refinement.md).

A prior audit matched 5 of 224 enabled company entries to standalone providers. That coverage classification was not rerun live here. Previous browser fixture success is not real ATS certification; the earlier BLEN network failure proved neither support nor a browser logic error.

The fork contains a Go dashboard. Source for separately reported ports 3000/8000 was not located in the bounded repository inventory. S0 must locate it or explicitly select the single replacement workspace; health is not data lineage.

Planning checks are available now:
~~~powershell
node roadmap/validate-roadmap.mjs
node --test roadmap/validate-roadmap.test.mjs
~~~
They validate local links, required stage structure, dependency cycles, produced/consumed handoffs, acceptance cases and the unchanged original workflow. They do not execute future product acceptance. See the validation record for actual results.

EGM drift reporting was used; no formal fresh-context EGM review/convergence is claimed. No product code or private data was changed, and no live model/mail/Discord/application action was taken.

Stage vocabulary remains Pending, In progress, Blocked with named dependency, Verified for stated scope, and Shipped with implementation evidence. Detailed and validated planning is not a Shipped product stage.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 8. Decisions Still Requiring A Choice

1. Freeze the S1 framework/provider/model and whether any existing web source is reusable. Recommended: modular TypeScript/Node application, React 19 workspace, shared typed tools; do not add a second agent stack.
2. Approve exact storage paths, backup protection, migrations, and private session custody.
3. Choose independent Dossier-inspired implementation, explicit AGPL-compatible reuse, or separately licensed permission before copying source.
4. Select search provider and budget after testing relevant NoVA/DC queries; direct Career-Ops providers remain complementary.
5. Approve S6's visible browser/review/session design and support matrix. Greenhouse/Lever first is a pilot, not a company-wide guarantee.
6. Choose Gmail operations/consent and confirm the existing Discord destination/schedule without pasting credentials into chat.
7. Freeze the November 19 script and the live capabilities it actually requires.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 9. Next Execution

1. Review [the detailed stage index](stages/README.md) and [shared contracts](stages/contracts.md); stage files now exist rather than remaining future planning work.
2. Start [S0](stages/stage-00-ownership-and-baseline.md): resolve only blocking bindings, prove protected restore, inventory every writer and classify known failures.
3. Implement [S1](stages/stage-01-workspace-and-agent.md) as a real persistent dashboard/agent, not a mock shell.
4. Continue the core path; add discovery/integrations only for selected claims. Reconcile later plans with actual delivered interfaces before coding.
5. Record per-case tests and What Shipped before promoting any implementation stage. Formal EGM review remains available with its required human configuration/resolution gates.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 10. Miscellaneous Additions

Capture additional user-journey, integration, or product ideas here. Give each a desired outcome and proposed stage; do not silently expand MVP scope.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## Revision Record

| Date | Change |
| --- | --- |
| 2026-11-16 | Preserved original commented workflow; created target manifesto and high-level roadmap |
| 2026-11-16 | Incorporated eight decision-group replies; moved dashboard/agent to S1 and onboarding to S2 |
| 2026-11-16 | Evaluated ten external references; installed EGM 0.1.1; added component, setup, and development documents |
| 2026-11-16 | Refined dependencies/ownership/security; added 12 detailed stages, 92 cases, contracts, drift report and executable planning validation |
