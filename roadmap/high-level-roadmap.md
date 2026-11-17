# Maxim Apply High-Level Roadmap

**Status:** Revision 0.3 refined target plan with detailed stage specifications. Implementation and unresolved design choices remain unapproved until their gates pass.
**Updated:** 2026-11-16. **Demo target:** 2026-11-19, scope not yet frozen.
**Implementation standing:** S0 and S1 verified; S2-S11 Pending. The [workspace evidence](reviews/s1-workspace.md) records the actual Astryx/Next/PostgreSQL delivery. No legacy cutover or new application-browser executor is claimed.
**Companions:** [Index](README.md), [manifesto](MANIFESTO.md), [component assessment](external-components-assessment.md), [setup](operational-setup.md), [development workflow](development-workflow.md).

## 1. Outcome And Planning Discipline

Deliver one conversational application workspace that remembers approved candidate knowledge, finds appropriate jobs, retains Career-Ops scoring and PDFs, prepares supported forms, and gives the person a clear manual review/submission experience.

Build the actual dashboard and agent early. Each later stage must improve that same user journey, with persistent records and observable failure behavior. Avoid a long backend-only sequence followed by a dashboard whose integration exposes missing contracts.

Following the inspected Vantage planning style, every stage has an objective, thin end-to-end proof, scope, dependencies, acceptance, and deferrals. The [detailed stage index](stages/README.md) now supplies concrete scope, proposed modules/tests, 92 acceptance cases, dependencies and handoffs. Proposed tests are not runnable until their producing stage implements them; no delivery evidence is invented.

A deadline never makes a stage Verified. A smaller demo requires an explicitly narrower claim, not hidden mocks or revival of rejected browser code.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 2. Baseline And Authority Change

| Existing area | Treatment |
| --- | --- |
| Career-Ops scoring/modes/PDF/report/liveness/providers | Retain capabilities behind explicit adapters and regression coverage |
| CV/profile/private evidence files | Preserve and import with provenance; authority changes only after reviewed candidate cutover |
| Markdown tracker + SQLite Maxim store | Current legacy authorities; reconcile before one application DB writer is enabled |
| Rejected Maxim auto-apply planner/mapper/runner/navigation | Inventory and retire safely; not the replacement executor |
| Native Go dashboard | Preserve usable behavior; adapt/gate writes before canonical application cutover |
| Separately reported web ports 3000/8000 | Locate source/data lineage in S0; earlier inspection did not find them in this fork |
| Networking/recruiter/history/analytics | Preserve private data; adapt useful features, do not indiscriminately delete |
| Discord webhook | Historical implementation exists; delivery acceptance/retry defect must be resolved |
| Gmail | No live repository-owned adapter established by the baseline audit |

Earlier evidence, not rerun here: 61/64 targeted tests passed, eight browser fixtures passed, only 5 of 224 enabled company entries matched standalone source providers. BLEN live inspection was blocked before loading by network access. These facts do not establish current operational readiness.

Latest accepted directions supersede older side-store-only and native-Go-only target constraints. They do not authorize rewriting the Career-Ops engine or treating PostgreSQL as current before migration. Maintain current DATA_CONTRACT behavior until its specific replacement is implemented and verified.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 3. Decisions And Architecture Gates

| Topic | Standing |
| --- | --- |
| Dashboard + agent near the beginning | Accepted; S1 |
| PostgreSQL + private artifacts + local Compose | Accepted target; exact deployment/restore details required |
| PDF/DOCX/MD/TXT upload and review | Accepted starting scope; extraction/consent limits still need detailing |
| Confirmed facts + contextual answer reuse + bounded context | Accepted principle; schema and numeric budgets open |
| Career-Ops reuse/retirement | Accepted; explicit inventory, adapters, and ownership migration required |
| Greenhouse/Lever pilot, later custom company/Workday/LinkedIn/etc. | Direction accepted; per-site evidence/permission required |
| Existing maxim applier Discord | Reuse accepted; destination and scheduling must be confirmed locally |
| Model/runtime/design dependencies | Next/React 19/Astryx pinned and verified in S1; OpenAI adapter configured through Settings; agent-browser remains S6-gated |
| Dossier source reuse | AGPL decision required before copying; independent implementation recommended by default |
| Final submission | User review/manual action remains policy; no auto-submit scope |

Do not re-ask the user to choose PostgreSQL as if it were still open. Do not treat the user's interest in a repository as approval of its entire architecture, model costs, permissions, or license implications.

Create small decision records for chosen stack, persistence/retention, source reuse, compatibility patch boundary, browser policy, and integrations while detailing stages. Proposed future environment keys are not implemented configuration.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 4. Stage Register

| ID | Name | Thin user-visible proof | Dependencies | Status |
| --- | --- | --- | --- | --- |
| S0 | [Ownership, safety, and architecture baseline](stages/stage-00-ownership-and-baseline.md) | Trace one recoverable record/artifact and approve the minimal stack/cutover boundaries | Accepted direction; bounded audit | Verified |
| S1 | [Real workspace and contextual agent](stages/stage-01-workspace-and-agent.md) | Add a job/application in UI; ask agent about same ID; restart and read it | S0 | Verified |
| S2 | [Reviewed candidate onboarding](stages/stage-02-reviewed-onboarding.md) | Upload, review/correct, confirm, restart, retrieve sourced facts | S1 | Verified |
| S3 | [Reusable answers and bounded context](stages/stage-03-answer-memory.md) | Answer once, recall in scope, correct/revoke, suppress old reuse | S2 | Pending |
| S4 | [Coverage-aware discovery](stages/stage-04-discovery.md) | Ingest a new role; expose unsupported/failed source separately | S2 | Pending |
| S5 | [Career-Ops evaluation, packet, and tracker cutover](stages/stage-05-evaluation-and-tracker-cutover.md) | Evaluate/prepare one role; prove one lifecycle after migration | S3; S4 only for automated-discovery jobs | Pending |
| S6 | [Supported browser application assistance](stages/stage-06-browser-assistance.md) | Fill supported controls, ask unknowns, resume, stop at manual review | S5 and approved browser design | Pending |
| S7 | [Gmail evidence and response tasks](stages/stage-07-gmail-evidence.md) | Link a consented thread; hold ambiguous match; handle revoked access | S5 | Pending |
| S8 | [Durable existing-Discord delivery](stages/stage-08-discord-delivery.md) | Accept alert once; fail/retry visibly; digest matches confirmed state | S5; S4 automated freshness; S7 Gmail; S9 networking/manual recruiter alerts | Pending |
| S9 | [Networking and outcome insight](stages/stage-09-networking-and-analytics.md) | Rank contacts/draft manual outreach; show correct limited analytics | S5 (includes S3) | Pending |
| S10 | [Evidence-grounded interview preparation](stages/stage-10-interview-preparation.md) | Evidence-grounded project/behavioral/system-design practice saved in workspace | S5 (includes S3); optional | Pending |
| S11 | [Product and demonstration acceptance](stages/stage-11-product-acceptance.md) | Rehearse exactly the approved delivery slice with recovery evidence | S6; selected optional stage proofs | Pending |

This revision renumbers/reorders earlier draft stages. In particular, old S7 conversation/views becomes early S1; onboarding becomes S2. Old runner retirement is a bounded S0 inventory and S5 cutover obligation, not a prerequisite to seeing any useful UI. Older v1.1 phase numbers are a separate scheme.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 5. Dependency Order And Non-Circular Proofs

~~~mermaid
flowchart TD
    S0[S0 baseline and architecture] --> S1[S1 real workspace and agent]
    S1 --> S2[S2 onboarding and first durable worker]
    S2 --> S3[S3 answer memory]
    S2 --> S4[S4 discovery]
    S3 --> S5[S5 evaluation, packet and tracker cutover]
    S4 -.-> S5
    S5 --> S6[S6 supported browser assistance]
    S5 --> S7[S7 Gmail]
    S5 --> S8[S8 Discord]
    S5 --> S9[S9 networking and metrics]
    S5 --> S10[S10 optional interview practice]
    S7 -.-> S8
    S9 -.-> S8
    S4 -.-> S8
    S6 --> S11[S11 assisted-application acceptance]
    S4 -.-> S11
    S7 -.-> S11
    S8 -.-> S11
    S9 -.-> S11
    S10 -.-> S11
~~~

Solid arrows are mandatory prerequisites; dashed arrows apply only when the consuming capability is claimed. S5 can evaluate manual S1 job intake without a search provider. Automated discovery claims require S4.

Core path: S0 -> S1 -> S2 -> S3 -> S5 -> S6 -> S11. S4 can run alongside S3 after S2. S7-S10 can run alongside S6 after S5; interview practice never blocks applications.

S1 proves real manually entered records and conversation, not an unused worker shell. S2 introduces the first consumed durable worker for extraction; discovery and integrations reuse it rather than assuming infrastructure from a future stage.

Candidate authority changes at S2, application/tracker authority at S5 and contact/history adaptation at S9. Each entity family has one current production writer. Native direct writers must be adapted or gated before the switch.

The Windows-first proposed binding is host web/worker/visible browser with loopback PostgreSQL Compose. S0 may change the binding only with explicit tested session/network consequences.

S11 requires S6 for full assisted-application acceptance plus each optional stage it claims. A foundation-only S0-S3 rehearsal is a smaller named milestone, not a completed application MVP.

See [shared contracts](stages/contracts.md) and the [stage registry](stages/manifest.json) for producer/consumer and conditional-dependency checks.

> **Comments**
>
> Add roadmap-level corrections here.

## 6. S0: Ownership, Safety, And Architecture Baseline

**Detailed specification:** [S0 plan](stages/stage-00-ownership-and-baseline.md).

**Objective:** Know the real code/data boundaries, preserve recoverability, and choose a minimal architecture before changing authorities.

**Thin E2E proof:** Trace one candidate/job/application/artifact path through its actual readers/writers, restore a private synthetic backup, and record an approved implementation boundary.

**Scope**
- Locate the reported web app/API or document its source as unlocated after a bounded search. Decide reuse versus one new workspace, not another side CRM.
- Inventory native Career-Ops, useful Maxim, rejected runner entry points, write paths, imports, dashboard bindings, tests, and migration bridges.
- Inventory tracked/ignored/history exposure, build contexts, backups, data roots, and secrets by protected metadata-first checks. No blanket claim of clean Git history.
- Decide modular runtime/framework/model/tool interface, version pins, PostgreSQL/private volume layout, artifact access, local auth, and backup/restore requirements.
- Review Astryx compatibility and Dossier licensing options. Default to independent Dossier-inspired contracts/UX until source reuse is explicitly approved.
- Adopt the installed EGM development workflow. Graphify is optional source-only analysis after an allowlist; do not install global hooks or index candidate data.
- Approve retirement inventory and regression baseline. Disable dangerous/stale recommendations only through scoped changes; preserve useful data and native PDF/liveness dependencies.

**Acceptance**
- [x] Owner/path/read-write map and patch inventory exist; unknown source locations are honestly labeled.
- [x] A backup/restore proof covers records plus linked artifacts and rollback boundaries.
- [x] Existing test failures are reproduced or clearly labeled historical; exact practical baseline commands are selected.
- [x] Stack and privacy decisions needed by S1 are recorded; all optional components have nonblocking dispositions.
- [x] Dossier copying is blocked pending a license decision; no secrets/personal content enter research artifacts or Git.

**Handoff:** S1 receives actual paths, selected stack, minimal commands/contracts, safety rules, and known regressions.

**Deferred:** Unapproved history rewriting, deleting databases or private records, broad source removal, full graph runtime, remote browser design, and every optional integration.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 7. S1: Real Dashboard, Agent, And Persistent Foundation

**Detailed specification:** [S1 plan](stages/stage-01-workspace-and-agent.md).

**Objective:** Give the user an operational baseline immediately, then grow the same experience.

**Thin E2E proof:** Add a posting and application intent through the dashboard; ask the agent about the same record; confirm one simple change; restart app/DB; see the identical ID/revision and activity.

**Scope**
- Implement the approved local composition (proposed: host web/worker and loopback PostgreSQL Compose), persistent PostgreSQL and private artifact boundary, migrations, minimal candidate/workspace/job/application/conversation/event contracts, and shared service API.
- Provide a useful navigation shell, job list/detail, applications view, activity, contextual agent, and settings/integration status. No unimplemented control may imply success.
- Use Dossier's task organization as a reference, not its AGPL component source by default. Evaluate Astryx as the single UI foundation; prove React 19, CSS order, keyboard/focus, tables/dialogs, and chat rendering before committing.
- Implement one bounded model adapter with typed reads and confirmation-gated mutations. Record conversations/tool references separately from facts.
- Make add/view/update usable without a model; model unavailability cannot hide or fabricate DB records.
- Provide real loading/empty/stale/failure states and an explicit isolated fixture/demo mode. No automatic mock fallback.
- Do not automatically import or override the production legacy tracker. Label the new/fixture workspace and ownership state clearly.

**Acceptance**
- [x] UI and agent share command handlers, candidate/workspace scope, record IDs, revisions, and event history.
- [x] Repeated commands are idempotent; stale revision, unauthenticated mutation, and unconfirmed consequential action are denied.
- [x] Records/conversation references survive the documented restart/recreate path; recovery doesn't lose artifact metadata.
- [x] Backend/model failure is visible, and retry cannot manufacture application success.
- [x] Desktop/mobile navigation, text fitting, keyboard access, and chat/tool error states pass UI checks.
- [x] Real build/start/check commands, local URL, persistence location, and backup/restore instructions are documented.

**Handoff:** S2 gets a real upload/review host and durable candidate API; S4 gets a job-ingestion/read API. No browser or scanner is needed for S1 acceptance.

**Deferred:** Full legacy cutover, document extraction, advanced memory, vector search, job scanning, form execution, Gmail, or additional agent frameworks.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 8. S2: Reviewed Candidate Onboarding

**Detailed specification:** [S2 plan](stages/stage-02-reviewed-onboarding.md).

**Verified implementation:** [Case evidence](reviews/s2-onboarding.md), 2026-11-17.
This is opt-in reviewed candidate authority, not automatic import/approval of private files.

**Objective:** Intake once through the early workspace and make the retained Career-Ops context derivable from reviewed facts.

**Thin E2E proof:** Upload a synthetic supported resume, review source-linked extraction, correct a conflict, confirm, restart, and ask UI/agent for the approved value and source.

**Scope**
- Begin with PDF, DOCX, Markdown, text; define file signature/size/page limits, safe extraction, source hashing, duplicate detection, and unsupported/scanned-PDF handling.
- Extract locally first. Model interpretation requires explicit provider disclosure, minimized/redacted content, and consent; proprietary employer material is excluded.
- Separate source bytes, extracted proposals, confirmed facts, preferences, and unresolved issues. Show conflicts without import-wins overwrites.
- Support manual/chat intake and partial onboarding; identify the minimum profile fields actually needed for a task.
- Import existing approved profile/evidence carefully, preserve raw source and provenance, and prove candidate ownership cutover. Generate required Career-Ops projections from canonical facts after cutover.
- Introduce the first real durable extraction worker with claim/renew/complete/cancel, retry and lost-lease rules; later consumers reuse it.
- Define source retention/deletion and revocation propagation; never put raw uploads into Git or a model's general memory.

**Acceptance**
- [x] Each supported format has representative success/error fixtures; unreadable/scanned/unsafe inputs produce actionable states, not invented facts.
- [x] Only reviewed confirmations change canonical facts, with revisions and local events committed together.
- [x] Duplicate uploads/conflicting dates/contact values do not silently overwrite or duplicate accepted facts.
- [x] Privacy/consent denial leaves local/manual onboarding usable and prevents model disclosure.
- [x] Approved facts survive restart and feed a compatible Career-Ops context; rejected proposals are not consumed.
- [x] Candidate cutover/rollback is proved without an active second editable profile authority.

**Handoff:** S3 receives approved typed facts, source/revision IDs, preferences, consent and sensitivity rules.

**Deferred:** OCR/multimedia unless explicitly selected, arbitrary archives, autonomous bulk approval, and claims that a resume proves employment or credentials.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 9. S3: Reusable Answers And Bounded Context

**Detailed specification:** [S3 plan](stages/stage-03-answer-memory.md).

**Objective:** Stop repeat questioning while preventing stale or context-incompatible claims.

**Thin E2E proof:** Answer an unknown question once, approve reuse, recall company-first then within-candidate cross-company scope, correct/revoke it, and prove old reuse is suppressed in both UI and agent.

**Scope**
- Persist exact question, normalized type/tags, company/role context, answer versions, evidence, sensitivity, reuse permission, and actual uses.
- Look up standard facts first; search employer-specific answers before the same candidate's compatible cross-employer library.
- Distinguish searchable history from approved filling. Context-sensitive employer relationships, compensation, attestations, and voluntary self-ID stay reviewable.
- Build task-shaped context using direct reads plus lexical/full-text retrieval; include only relevant revisions and concise evidence.
- Instrument full model requests and actual usage. Validate Microsoft Tokenizer only against the selected model/encoding; unknown models must not be silently mapped to old encoders.
- Invalidate dependent drafts on fact/answer correction; retain historical submitted versions without rewriting them.

**Acceptance**
- [ ] Correct lookup order and candidate isolation hold, including no cross-user leakage.
- [ ] Unknown/ambiguous/withdrawn answers produce a question or review state, never a fabricated fill.
- [ ] Approval scope and sensitive-answer rules are enforced by services, not only prompts.
- [ ] Corrections affect future recall and dependent artifacts; old submission evidence remains historical.
- [ ] Captured synthetic requests meet the approved complete context budget; unsupported tokenization is explicit.
- [ ] UI and agent can inspect/approve/correct the same answer record and see persistence after restart.

**Handoff:** S5/S6 receive a reusable answer API and evidence/context contract, not raw conversation dumping.

**Deferred:** Embeddings without a measured retrieval failure, graph-derived facts, external skill-owned profile files, and credentials in answer memory.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 10. S4: Coverage-Aware Discovery

**Detailed specification:** [S4 plan](stages/stage-04-discovery.md).

**Objective:** Discover appropriate openings without silent provider/source gaps.

**Thin E2E proof:** Search/scan one supported source, ingest a new role once, save/dismiss it, reopen its details/history through UI/agent, and separately expose failed/unsupported coverage.

**Scope**
- Retain useful Career-Ops direct company/provider scanning. Normalize provider results and source runs into canonical job identities plus aliases.
- Adapt Dossier's provider-contract pattern independently by default: query/result schema, cursor/pagination, provider configuration, typed errors, timeout/quota bounds.
- Evaluate JSearch as a broad-search candidate; Adzuna as another option; FreeHire only after coverage/reliability checks. A provider subscription/API key is separate setup, not platform login.
- Persist search history, filters, source/provider/destination identities, original posted time, first-seen time, run status, partial pagination, attribution, and freshness.
- Show Search, Past searches, Saved, and Dismissed through the early workspace, with relevant local policy filters.
- Surface unsupported tracked companies with a fallback/review obligation. Discovery does not wait for an application adapter.
- Choose budget/cadence appropriate to fresh-role alerts; don't blindly inherit Dossier's daily caps/single-process scheduling.

**Acceptance**
- [ ] Fixture/new provider role ingests once with stable aliases and correct source dates.
- [ ] Empty, partial, stale, unsupported, challenge/authentication, quota, HTTP, and schema failures remain distinguishable.
- [ ] NoVA/DC location rules still apply when a provider ignores radius or broadens a location query.
- [ ] Direct-provider and aggregator results can coexist without duplicating an actionable opening.
- [ ] Bounded pacing/retries and provider-specific terms/attribution are recorded; no unofficial prohibited source or evasion is added.
- [ ] Live acceptance tests, if claimed, record actual provider/query/time/coverage; fixtures alone prove only the adapter contract.

**Handoff:** S5 gets normalized postings, provenance, freshness and coverage state. LinkedIn/Indeed-origin results do not imply apply permission or a first-party connector.

**Deferred:** Universal internet completeness, guaranteed real-time aggregator indexing, unbounded crawling, and application/message automation.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 11. S5: Career-Ops Evaluation, Packet, And One Tracker

**Detailed specification:** [S5 plan](stages/stage-05-evaluation-and-tracker-cutover.md).

**Objective:** Use the retained engine in one observable lifecycle and finish controlled operational cutover. Manual jobs from S1 do not require S4; automated-discovery inputs do.

**Thin E2E proof:** Ask the agent to evaluate a discovered/stored role, inspect the same Career-Ops score in UI, prepare/approve a linked PDF, record a reviewed action, and prove all supported readers agree after migration.

**Scope**
- Retain Career-Ops evaluation semantics, 1.0-5.0 score, reports, native PDF generation, and confirmed policies. Record model/provider/context/source versions.
- Use T0/T1/T2/T3 mapping and separate priority/readiness/eligibility flags. Search similarity, resume critiques, or networking ranking never become another fit score.
- Gate expensive packet work on intent/readiness; explicitly select and approve attachment versions.
- Optionally adapt Hiring Panel as user-triggered evidence-grounded critique, with budget/cached revision keys and reviewable diffs. Full eight-pass workflow is not the default for every role.
- Reconcile native Markdown, SQLite, events/history and artifacts using stable IDs, raw values, status mapping and conflict reports. Prove backup/rollback before disabling legacy writes.
- Adapt or gate native TSV/merge/direct tracker/dashboard write paths. Internal compatibility is not a permanent user-run sync workflow.
- Retire the rejected runner's entry points, imports, docs and active registrations once dependent data/paths are preserved; keep native Playwright PDF/liveness and useful safety scenarios.

**Acceptance**
- [ ] Score bands, confirmed location/salary/clearance rules, and next actions pass focused tests.
- [ ] One command identity cannot create duplicate evaluations/applications or overwrite reviewed artifacts.
- [ ] Packet links identify exact evidence/evaluation/resume revision; fabricated claims and placeholders cannot enter approved PDFs.
- [ ] Migration comparisons cover counts, IDs, raw fields, status history, score/tier at action, artifacts and conflicts; rollback works.
- [ ] One production writer exists per application; supported native commands/readers cannot silently diverge.
- [ ] No live route invokes the retired runner, and agreed native regression checks still pass.
- [ ] Prepared/reviewed/filled/submitted/outcome states remain distinct in UI and agent.

**Handoff:** S6 receives one application identity, approved packet, reusable answers, event/command API and duplicate policy. S7-S10 can build on the same lifecycle.

**Deferred:** Rewriting scoring/PDFs, automatic score-policy changes, mandatory costly resume panels, autonomous submission, and deleting historical source data.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 12. S6: Supported Browser Application Assistance

**Detailed specification:** [S6 plan](stages/stage-06-browser-assistance.md).

**Objective:** Complete as much of a supported form as possible and hand it to the user reliably.

**Thin E2E proof:** In an authorized visible session, fill sourced fields, attach the approved PDF, ask one unknown question, remember its approved answer, pause/recover/resume, and stop at a durable manual review point.

**Scope**
- Approve user flow, threat model, account/login authority, dedicated session custody, sensitive controls, attachment handling, review/handoff and recovery before implementation.
- Spike agent-browser on Windows/Chromium with pinned package/version, fresh accessibility refs, cross-frame/file/multistep controls, bounded actions, origins, timeouts and session restart behavior.
- Keep Maxim policy and shared answer lookup outside the executor. Exclude stealth, CAPTCHA solvers, evasive plugins, arbitrary agent scripts, and uncontrolled browser attachment.
- Begin with representative Greenhouse/Lever forms; plan subsequent company/custom and Workday variants. Track LinkedIn/Indeed as desired, permission-dependent future coverage with explicit manual fallback.
- Maintain separate capability states for discovery, inspect, fill, upload, navigation, authentication/session, pause/resume, review and final manual action.
- Provide field evidence/uncertainty, progress, correction and final checklist in the same dashboard/agent; no private browser-owned answer store.
- Enforce no final-action command. Test keyboard submission, form events, network effects and confirmation screens, not only button-label heuristics.

**Acceptance**
- [ ] Supported form variants and unsupported controls are enumerated; no universal/company-wide claim follows from one fixture.
- [ ] Unknown/sensitive/ambiguous fields pause safely and reuse only approved scoped answers.
- [ ] Correct attachment identity and prior fact corrections survive pause/resume/restart.
- [ ] Stale refs, iframe changes, navigation errors and partial fills produce recoverable reports without false submission.
- [ ] Credentials/cookies remain protected; login/MFA/challenges are user-controlled and not bypassed.
- [ ] Final-action/hidden-send attempts are denied by the service/executor boundary, including adversarial page instructions.
- [ ] User-confirmed submission or attributable receipt evidence is recorded distinctly from filled/reviewed state.

**Handoff:** One usable, truthfully bounded assistance path. Real-site tests must stop before submission unless the user manually performs it; test forms use isolated fixtures.

**Deferred:** Universal ATS support, automatic account creation, remote mode without separate design, unattended final action, and bypassing platform controls.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 13. S7: Gmail Evidence And Response Tasks

**Detailed specification:** [S7 plan](stages/stage-07-gmail-evidence.md).

**Objective:** Link employer communication to the correct application without silent inbox-driven mistakes.

**Thin E2E proof:** With explicit consent, observe a job-related thread, link source IDs to an application, review an ambiguous match, then handle token revocation without losing tracker data.

**Scope**
- Choose product-owned OAuth/connection and a durable polling/history strategy. An assistant's Gmail plugin is not a deployed repository integration.
- Start read-only; disclose actual mailbox scope even if Maxim processes only selected messages. Define minimal retention and model-disclosure consent.
- Persist message/thread observation IDs and source links idempotently; use canonical commands for accepted tasks/status transitions.
- Distinguish an inferred rejection/interview hint from confirmed outcome; support correction.
- Show integration state, last successful observation, unassigned mail, and Needs Response in UI/agent.

**Acceptance**
- [ ] Repeated ingestion creates one observation/task; wrong or uncertain company-role matches do not mutate an unrelated application.
- [ ] Source evidence, human correction and retained/deleted content follow policy.
- [ ] Revoked/expired access and failed polling are visible and retryable within bounds.
- [ ] Mail/credentials are absent from Git, synthetic fixtures, public traces and notifications.
- [ ] No send/modify/calendar capability is implicitly added.

**Deferred:** Automatic replies, full mailbox classification by default, mail submission as an application bypass, and other mail providers.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 14. S8: Durable Existing-Discord Delivery

**Detailed specification:** [S8 plan](stages/stage-08-discord-delivery.md).

**Objective:** Reuse maxim applier for reliable high-fit alerts and progress, not a parallel bot-owned tracker.

**Thin E2E proof:** Deliver one canonical high-fit alert to a confirmed destination; simulate failure/429, recover and retry; show a digest whose counts match confirmed applications.

**Scope**
- Confirm the existing webhook/channel reference and permitted content privately. Do not create another Discord merely because destination IDs are not yet documented.
- Start webhook outbound delivery if sufficient; an interactive bot requires separate permissions/command design.
- Use transactional outbox, attempt/accepted/failed/unknown states, bounded backoff and persisted scheduling.
- Validate HTTP acceptance before dedupe suppression. Document duplicate risk for unknown outcomes; do not promise exactly-once external delivery.
- Configure urgent fresh T2+ alerts, routine queue batches, Needs Response reminders, weekly review and 21-day Saturday resume-variant review when included.
- Add mail-driven alerts only after S7. Use minimal safe content and local links rather than private answers/artifacts.

**Acceptance**
- [ ] Failure/429/non-success status is not marked accepted or permanently suppressed.
- [ ] Accepted dedupe and retry/unknown-outcome policy pass deterministic tests.
- [ ] Schedules survive worker restart and expose last/next run; dry-run works without secrets.
- [ ] Destination, opt-in content, timezone and redaction are explicit.
- [ ] Counts and alert eligibility match canonical score/tier/freshness/manual-submission state.

**Deferred:** Wearables, Discord as another agent authority, and interactive approval/sending commands unless separately designed.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 15. S9: Networking And Outcome Insight

**Detailed specification:** [S9 plan](stages/stage-09-networking-and-analytics.md).

**Objective:** Bring useful existing networking and analytics into the same user journey.

**Thin E2E proof:** Import a private connection-export fixture, rank relevant people for one T2/T3 role, create a research-backed draft, mark sent manually, and view the resulting canonical outcome breakdown with a small-sample warning.

**Scope**
- Preserve/adapt contacts, subjective strength 1-3, alumni/recruiter/founder/relevance signals, target records, research, drafts, recruiter tags, and manual history.
- Use authorized connection CSV/ZIP exports or supplied/public research. The suggested LinkedIn connector is not a job/DM/live-people-search adapter; publishing scopes/tools are unnecessary.
- Explain shortlist ranking without creating another job-fit score.
- Draft the required five parts: person research, role, supported candidate background, fit rationale, call to action.
- Keep ready_to_send, sent_manually, replied, follow_up_due, referral_asked, referred, declined and no_response; marking responded clears Needs Response.
- Compute NoVA/DC interview rate over unique confirmed submitted attempts in a declared cohort, with score/tier/source/lane/variant/networking/strength/freshness breakdowns. Unknown location/outcome is reported separately; discovered/evaluated rows are not the denominator. Preserve raw history and treat Interview Round separately from soft status.

**Acceptance**
- [ ] Imports are idempotent, raw source remains private, and manual statuses survive reruns.
- [ ] Unrelated contacts cannot rank solely from generic engineering keywords; explanations reference actual inputs.
- [ ] Drafts require research/evidence and have no automatic send path.
- [ ] Recruiter correction/responded state is consistent in UI/agent/notifications.
- [ ] Empty/small data runs safely; filters/denominators are testable and no causal claim is inferred automatically.

**Deferred:** LinkedIn social publishing/DM automation, undocumented partner APIs, large-scale profile scraping, and automatic strategy/scoring changes.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 16. S10: Optional Evidence-Grounded Interview Preparation

**Detailed specification:** [S10 plan](stages/stage-10-interview-preparation.md).

**Objective:** Reuse applicable skill ideas to help the candidate explain real experience and prepare for relevant interviews.

**Thin E2E proof:** Open a stored role, run a project-defense or behavioral/system-design practice, identify unsupported answer claims, and retrieve saved feedback in the same workspace after restart.

**Scope**
- Adapt selected Cracked workflows into the shared tool/knowledge contract; preserve Career-Ops interview prep and story bank.
- Keep candidate facts in the canonical store, not a parallel ~/.cracked profile. Store private session artifacts under the approved artifact boundary.
- Label community question banks as practice, not verified employer questions.
- Budget model calls and optional evaluation rubrics; no alternative job-fit score.
- Sandbox any code execution with explicit consent and bounded resources; no live-assessment cheating.

**Acceptance**
- [ ] Prompts and feedback cite approved candidate/job evidence and ask for missing facts.
- [ ] Practice sessions persist without promoting hypothetical answers to approved claims.
- [ ] Privacy, cost, cancellation and any execution boundary are explicit and tested.
- [ ] No dependency on completing Gmail, Discord or networking; this optional lane does not delay S6.

**Deferred:** Full skill-pack installation, every interview discipline, and automatic use of private mock answers in applications.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 17. S11: Selected Product And Demonstration Acceptance

**Detailed specification:** [S11 plan](stages/stage-11-product-acceptance.md).

**Objective:** Demonstrate a coherent usable workflow with truthful boundaries.

**Proposed assisted-application path:** real workspace -> reviewed onboarding -> approved answer recall -> declared discovery/manual job intake -> Career-Ops evaluation and packet -> supported visible form -> manual review/submission -> one tracker. Add Gmail, Discord, networking or interview prep only if selected and verified.

**Acceptance**
- [ ] Xavier approves a timed script, surfaces, supported sites and live/isolated example-data policy.
- [ ] Every included stage has passed its proof and negative cases; omitted features are labeled, not mocked as working.
- [ ] At least two rehearsals show record lineage, unknown-question memory, restart/recovery and manual final-action control.
- [ ] UI, agent, artifacts and integration counts agree; no manual reconciliation of competing trackers is required.
- [ ] Screen-share fixtures contain no real secrets, employer-private content, contacts or inbox data.
- [ ] Startup/recovery commands, screenshots/test results and known limitations are recorded with environment/date.

S6 is mandatory to mark S11 assisted-application acceptance Shipped. A foundation-only S0-S3 slice is useful but receives a narrower milestone record, not full S11 acceptance. No automatic deadline-based status promotion.

**Deferred:** All unselected stages and broad platform coverage.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 18. Verification And Stage Detailing Contract

The [detailed plans](stages/README.md) now define 3-8 concrete acceptance criteria per stage, existing versus proposed test commands, fixture boundaries, input/output contracts, rollback and What Shipped sections. S1 must implement the real product harness before later proposed commands can be executed. Do not create fake npm commands or test names for an unimplemented stack.

Each proof crosses UI/agent -> shared service -> storage -> read-back, where applicable. Include failures, authorization, duplicates, stale revisions, restart, privacy, and correction. Add browser command-effect tests rather than relying on static keyword bans.

Existing baseline entry points to inspect and run in the appropriate environment:

~~~powershell
node test-all.mjs
npm run doctor
npm run verify
npm run maxim:test
npm run maxim:safety
npm run maxim:alignment
~~~

Native dashboard checks, from its directory:

~~~powershell
go test ./...
~~~

These are existing command references, not execution results from this revision. Some assert older ownership; change only the obsolete assertion when a new contract is approved, preserving safety/regression intent. Do not discard tracker validation to make a database cutover appear clean.

Chosen frontend/database/worker add actual build, schema migration, integration, UI and restore checks. Pin external code, record license/notices/source revision, and test denied permissions/provider failures as well as success.

Formal EGM review requires confirmed configuration, fresh-context reviewers, findings, human resolution and recorded scope. A self-check or installation is not convergence.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 19. Demo Scope And Next Planning Action

The recruiter/FDE audience values a convincing end-to-end solution and an intelligible technical walkthrough. Prioritize one reliable natural-language assistance path over a broad dashboard with broken integrations.

Recommended planning order:
1. Review this high-level stage sequence and component dispositions.
2. Review the existing [S0/S1 detailed specifications](stages/README.md), freeze their blocking choices and execute only their accepted scope.
3. Validate S1's persistent UI/agent spine before promising later automation.
4. Reconcile S2/S3 detailed intake/reuse plans against the delivered S1 contracts before implementation.
5. Select the actual site/provider and demo slice before committing S4-S8 work to November 19.
6. Use the completed [code/design drift and validation record](reviews/roadmap-refinement.md), then optionally run formal EGM fresh-context review with its required confirmed configuration. The drift audit is not independent-review convergence.

No day-by-day delivery commitment is implied. If the supported application path cannot be proved safely, explicitly revise the demo claim with Xavier.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 20. Deferred Work And Component Gates

| Item | Why not assumed now | Return condition |
| --- | --- | --- |
| Dossier source transplant | AGPL obligations and engine/ownership conflicts | Explicit compatible licensing/provenance decision; otherwise independent implementation |
| Astryx adoption | Pinned 0.7.16 passes React 19 production build and desktop/mobile/keyboard workflows | S1 evidence recorded; maintain regressions |
| Tokenizer runtime dependency | Exact model/framing support not established | S3 fixture and usage comparison |
| agent-browser adoption | Session/control/policy coverage unproven in Maxim | S6 spike and final-action denial tests |
| LinkedIn publishing connector tools | No product need; excess write authority | Not part of this roadmap |
| Graphify runtime graph | Extra infrastructure, private-data inference risk, no measured retrieval need | Benchmark versus simpler retrieval plus privacy review |
| Hermes | Optional, user reluctant, no necessary gap or selected repository | Explicit need and user decision |
| Broad Workday/company/LinkedIn/Indeed support | Form variants, sessions, terms and controls differ | Tested per-site capability expansion and manual fallback |
| Remote browser/credential-account automation | Separate threat model and user authority needed | Approved future experience; never bypass MFA/challenges |
| Vantage code/runtime | Planning principles reusable without platform dependency | Concrete audited benefit and licensing/runtime decision |
| Wearables/Meta glasses | SDK/device feasibility not established | Shared status API and a separate feasibility proposal |
| Privacy remediation/history rewrite | Potentially destructive or exposure-sensitive | Approved protected procedure after actual findings |

Optional work must not become a silent blocker of the core application journey.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 21. Review Notes And Miscellaneous Additions

The [original review](current-system-workflow.md) remains unfinished and unedited. Detailed files are under [stages](stages/README.md); [validation](reviews/roadmap-refinement.md) records actual tests and remaining runtime gaps. Latest confirmed directions are mapped in the [index](README.md#3-latest-review-what-is-accepted); repository research is in the [assessment](external-components-assessment.md).

Add proposed capabilities, dependency corrections, stage priorities or unresolved user-experience details here. Each addition should name its benefit, stage, assumptions and acceptance proof.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.
