# Maxim Apply System Manifesto

**Status:** Target proposal, revision 0.3 with detailed stage contracts. Accepted direction and unapproved component recommendations are distinguished.
**Updated:** 2026-11-16.
**Basis:** [Original workflow and unfinished comments](current-system-workflow.md), the latest eight decision-group replies, and [external component research](external-components-assessment.md).
**Delivery standing:** No product implementation or migration is claimed by this revision.

## 1. Product Promise

Maxim Apply makes applying for appropriate jobs frictionless and efficient by remembering the person's actual background and approved answers, preparing useful materials, and helping complete supported application forms through conversation.

**One body of candidate knowledge. One application lifecycle. Several interfaces over the same facts.**

The user should not reconcile Career-Ops files, a separate Maxim tracker, disconnected model memories, and a browser script. The dashboard and agent are part of the product from the first useful implementation stage, not decorative surfaces added after every backend feature.

This is a controlled evolution of Career-Ops, not a fork of Dossier or a greenfield replacement of working scoring, PDF generation, or discovery providers. The new accepted target changes operational storage and introduces a single web workspace through explicit adapters and migration. It does not erase current contracts before replacement evidence exists.

Success means reduced repeated work, correct applications, visible uncertainty, and ultimately interview outcomes. It does not mean maximum application volume or autonomous submission.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 2. Principles And Non-Negotiables

1. One entity has one current write authority. Projections, summaries, exports, and caches are not independently editable truth.
2. Conversation is an interface. Confirmed facts and reusable answers are explicit, source-linked records.
3. Extraction proposes; the candidate confirms. Resume text is not independent verification of a claim.
4. Reuse is contextual, economical, and reversible. Stored history is not blanket fill permission.
5. Every stage improves the actual dashboard and agent journey.
6. Discovery and applying have separate capability matrices. Unsupported is not empty.
7. Career-Ops' 1.0-5.0 score is the only job-fit score driving tiers.
8. Candidate evidence, employer requirements, and model suggestions never share an undifferentiated claim authority.
9. Privacy includes files, DBs, model requests, traces, sessions, screenshots, notifications, backups, and repository history.
10. Models and browser tools have bounded authority. Untrusted files, postings, emails, and pages are data, not new instructions.
11. Reuse libraries only for a named benefit that passes compatibility, licensing, safety, and recovery checks.
12. Actual proof changes stage status. Screenshots, package installation, passing fixtures, and health checks have narrower meanings.

Never fabricate experience, tools, dates, credentials, metrics, citizenship, or clearance. Never distribute Wabtec internal/proprietary content. Do not automate LinkedIn messages, final application submission, hidden platform actions, CAPTCHA solving, or anti-bot evasion.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 3. The Curated User Journey

### Enter A Useful Workspace

The first usable dashboard contains real persisted jobs, applications, activity, and a contextual agent. A person can add a posting manually, inspect its record, create an application intent, and ask what is known or missing before automated discovery exists.

Backend/model failure is visible. No request failure substitutes sample jobs. Empty, loading, stale, disconnected, and explicit isolated demo/test states are different.

### Onboard Once

Drag in a supported PDF, DOCX, Markdown, or text document, or enter information through conversation. Show upload/extraction progress, unsupported/unsafe-file errors, proposed facts, conflicts, and source links.

The user corrects and confirms individual changes or a clearly scoped reviewed group. They choose what may reach a model. Dossier's preview-before-save pattern is useful, but automatic import-wins merging is not the conflict policy.

### Discover And Select

Search or scan declared sources, see freshness and coverage, save/dismiss results, and open the actual posting. A result identifies the discovery provider, original platform, and application destination separately. A LinkedIn-sourced search result does not grant LinkedIn automation access.

### Evaluate And Prepare

Ask to evaluate a stored role. Career-Ops produces the retained score/report using a bounded approved candidate context. Eligibility, priority overlays, packet readiness, and intended next action remain explainable.

Prepare a source-linked resume/PDF and answers when the user intends to proceed. An optional resume critique can suggest approved changes before final packet generation. It cannot quietly create achievements or a replacement fit score.

### Apply Conversationally

Ask to prepare a supported application in a visible, authorized browser session. Shared facts and approved answers fill supported controls. Unknown or context-sensitive questions return to the user. A new approved answer becomes available for future compatible uses.

Show progress, unresolved questions, attachment version, errors, and a review checklist. Pause/resume preserves the application record and reviewed answers. The user performs final submission; the system records only confirmed action or sufficiently attributable receipt evidence.

### Follow Through And Improve

The same application view holds status, packet versions, email evidence, response tasks, networking drafts, and optional interview practice. Discord reports canonical state rather than maintaining a second tracker.

The November 19 script must select a verified subset of this journey. Optional integrations must not disguise an incomplete supported-form path when that path is the claimed demonstration.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 4. Data Ownership, Persistence, And Migration

PostgreSQL plus private artifact storage and local Compose is the accepted target direction. Exact runtime versions, host paths, migrations, backup mechanism, and deployment configuration remain S0/S1 design details.

| Data | Authority after its approved cutover | Representation and change rule |
| --- | --- | --- |
| Candidate facts/preferences | Candidate service | Typed records, sources, revisions, confirmation and sensitivity |
| Novel answers and actual uses | Answer service | Exact question, scope/tags, answer revision, approval, evidence |
| Source uploads | Source/artifact service | Private bytes, metadata/hash in DB; retention and deletion policy |
| Jobs and aliases | Discovery/job services | Provider/source IDs, canonical opening identity, posting observations |
| Evaluations and tiers | Evaluation service using Career-Ops | Versioned score/explanation, policy flags, inputs/model provenance |
| Applications/outcomes | Application service | One lifecycle, events, intended actions and observed outcomes |
| PDF/report/draft versions | Artifact service using retained generators | Exact source/evaluation/resume versions and approval |
| Conversations/checkpoints | Conversation service | Messages/tool references; summaries are derived working context |
| Contacts/networking/recruiter tasks | Networking/inbox services | Private sources, ranked targets, manual actions, corrections |
| Integration work | Durable worker/outbox | Attempts, acceptance, retry/dedupe state and schedule |
| Credentials/sessions | Protected secret/session boundary | Opaque references, explicit authority; no raw secrets in prompts or answers |
| Code/templates/synthetic fixtures | Git repository | Reviewed changes, no real candidate or employer-private data |

One modular application may implement these boundaries. A table per concept is not a mandate for a microservice per concept.

### Persistence And Privacy

Use named/private persistent volumes or explicit protected host mounts, not a container writable layer. Bind local-only services appropriately; don't publish PostgreSQL on all interfaces. Keep private bytes out of source/build contexts. Restart/recreate and backup/restore must preserve matching artifact references, not just row counts.

Secrets should use OS-protected storage or protected runtime secrets. An encryption key beside an encrypted export in the same public archive does not protect it. Retention includes raw uploads, mail, conversation text, derived artifacts, private logs, and backup expiry.

### Entity-Level Cutover

Existing SQLite, Markdown, and profile files remain authoritative for their current paths until an approved entity-level cutover. Import raw values/provenance, establish stable IDs, reconcile conflicts and status history, verify links, prove rollback, then change the writer.

After cutover, Career-Ops file inputs/trackers are explicit projections or adapted command paths, not a competing writable tracker. Native TSV/merge and direct Markdown updates must be adapted or gated before application authority changes. No invisible permanent bidirectional sync.

S1 can prove the new architecture on an isolated fixture/new workspace while legacy data remains untouched and clearly separate. It cannot present both as one production tracker. Candidate cutover follows S2 approval and native profile-writer gating; application cutover follows S5 reconciliation. Contact/history authority is adapted at S9. Every acknowledged native write must reach the current authority or fail explicitly.

### Fork Compatibility

Pin/review upstream changes. Maintain a patch inventory with owner, reason, tests, and update strategy. Preserve the DATA_CONTRACT user/system separation, then revise exact authority declarations only when the migration is implemented. Generic upstream updates must not overwrite fork-specific contracts.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 5. Candidate Knowledge And Reusable Answers

### Distinct Kinds Of Information

A source records what was supplied. A confirmed fact records the candidate's accepted information. An approved reusable answer applies to compatible contexts. A conversation summary/checkpoint is a derived aid, not another authority.

Use typed identity/contact/education/experience/skill/authorization/preference records, with flexible source-linked assertions where needed. Do not force the entire profile into one prompt blob or maintain separate truth in `~/.cracked/`, a graph, each model's memory, and the application DB.

### Retrieval And Reuse

1. Identify candidate, company, role, exact question, answer type, sensitivity, and current policy.
2. Read directly applicable standard facts without a model when possible.
3. Search that candidate's approved company-specific answers.
4. Search compatible answers from the same candidate across employers.
5. Filter revoked, stale, unapproved, unsupported, expired, or context-incompatible results.
6. Present/adapt a sourced answer as a draft when contextual wording differs.
7. Ask the user when uncertainty materially affects the answer.
8. Save the approved answer, reuse scope, supporting revisions, and actual use through the canonical service.

Store novel answers for future lookup without assuming permission to automatically use every stored answer. Prior-employer relationships, compensation, availability, legal attestations, protected/self-identification information, and company-specific commitments require contextual handling. No cross-candidate reuse of personal answers.

Corrections/revocations affect future recall and dependent drafts. A previously submitted packet remains an immutable historical version; it is not silently rewritten. Deletion/redaction policy must address sensitive log text as well as current rows.

### Bounded Model Context

Start with direct facts, tags, and PostgreSQL lexical/full-text retrieval. Add vectors/reranking only after a measured recall gap. A task context contains relevant IDs/revisions, concise evidence, unresolved questions, and policy, not every resume and conversation.

Microsoft Tokenizer is a candidate counting adapter, not memory. Its inspected TypeScript model map does not establish compatibility with every current/future model. Validate the selected model/encoding and full request framing; otherwise use a supported counter and declare estimates. Pre-cache required vocabularies for offline use.

Budget instructions, tool schemas/results, history, retrieved evidence, and output reserve. Track actual provider usage and cost where available; a local count does not prove the provider's billed token count. Numeric budgets and retention durations are not chosen by this document.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 6. Application And Agent Architecture

The recommended architecture is one modular TypeScript/Node application with a React 19 web workspace, PostgreSQL, private artifact storage, and a durable worker. Framework, model/provider, agent toolkit, schema tooling, and any located web-source reuse still require a small S0/S1 decision. These are recommendations, not a claim that a new stack was installed.

The detailed plans propose a Next.js workspace under maxim/app as the concrete S0 binding, not a requirement to copy Dossier's application. Windows-first default: host web/worker/visible browser with loopback PostgreSQL Compose; no assumed container-to-desktop bridge. S2 extraction introduces the first consumed durable worker. Preserve existing MJS capability adapters and Go dashboard compatibility. An additional Python/Rust service, Graphify runtime, or Hermes orchestrator is not justified by the core MVP.

| Boundary | Owns | Does not own |
| --- | --- | --- |
| Candidate/source/answer | Reviewed knowledge and targeted retrieval | Browser sessions or a model's private truth |
| Job/evaluation/application | Stable IDs, retained scoring, lifecycle, packet readiness | Separate fit scores for each interface |
| Conversation/tools | Intent translation, bounded reads, proposed commands and confirmations | Arbitrary SQL, unrestricted shell, silent fact approval |
| Career-Ops adapters | Reused scoring/providers/PDF/report/compatible IO | Another active tracker after cutover |
| Browser adapter | Allowed session actions and observed form state | Final submission or independent answer memory |
| Gmail adapter | Consented observations and reviewable links | Broad silent classification or automatic mail sending |
| Notification worker | Durable attempts/schedules/redacted delivery | New authoritative status changes |
| Dashboard/agent/CLI | Views and commands over shared services | Mock fallbacks or business rules duplicated per surface |

The UI and agent expose the same authorization, revision, and idempotency rules. Chat can propose a change; sensitive or consequential commands require explicit confirmation. Tool approval is not fact approval, and a model-generated tool call cannot approve itself.

Persist domain changes and local events atomically. Use an outbox/worker for external effects. Persist retries and schedules across restart; don't equate process timers or a manual command with durable automation.

### Target Topology

~~~mermaid
flowchart TD
    UI[Early dashboard, onboarding, contextual agent, supported CLI] --> APP[Shared typed commands, reads, policy]
    APP --> DB[(PostgreSQL)]
    APP --> FILES[Private sources and versioned artifacts]
    APP --> CO[Career-Ops evaluation, scanning, PDFs and reports]
    APP --> MODEL[Selected model behind bounded context and tool adapter]
    APP --> BROWSER[Supported visible browser sessions]
    DB --> WORK[Durable work and integration outbox]
    WORK --> MAIL[Consented Gmail observation]
    WORK --> DISCORD[Existing maxim applier Discord]
~~~

The model is not the database and the browser is not a trusted interpreter of page instructions. External content cannot expand tool privileges or inject requests to expose candidate sources.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 7. Dashboard And Discovery Experience

### Early Workspace

S1 delivers real jobs/applications/activity plus a working contextual agent. S2 adds onboarding to that same workspace. Later stages improve the same views, not a succession of disconnected dashboards.

Use Dossier's information architecture as a strong reference: persistent navigation; search/history/saved/dismissed views; list/detail inspection; contextual application work; progress, retry, and version history. Adopt the task organization, not its branding, sample candidate, oversized visual treatment, entire component stack, or another database authority.

Astryx is the preferred design-system candidate, with a React 19, build/CSS, keyboard/focus, upload, table, dialog, and chat-renderer spike. Use one base component system and restrained operational styling. Do not stack Astryx and Dossier's Radix/shadcn component implementation just to copy screenshots.

Dossier is AGPL-3.0. Independent implementations of the desired UX/contracts are the default recommendation. Copy/adapt source only after an explicit compatible licensing/provenance decision; do not assume a public repository or an API boundary removes obligations.

### Coverage-Aware Search

Retain useful Career-Ops company/provider scanning. Add a normalized search-provider boundary inspired by Dossier, if selected, for broader discovery. JSearch and Adzuna are candidates requiring provider setup; FreeHire is an optional public/self-hosted source requiring a coverage/reliability check.

Dossier's useful search capability is a provider-backed workflow, not a universal proprietary search engine. Aggregated LinkedIn/Indeed results are not direct platform APIs and do not provide apply/message access. Exclude unofficial sources that conflict with provider terms.

Record provider, original source, destination URL/job ID, filters, query, run ID, quota/error/partial-pagination state, last successful observation, and posted time separately from first seen. Preserve saved/dismissed state and aliases across providers. Related but materially different openings can coexist.

The UI and agent distinguish successful empty, partial, stale, unsupported, authentication/challenge, quota, and network/schema failures. No free endpoint, third-party index, or configured company list justifies promising complete real-time internet coverage.

A provider's radius/country/location limitations must remain visible. Apply NoVA/DC policy locally even if a search provider broadens a query. User preferences drive queries, not merely the current job title on an imported resume.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 8. Evaluation, Packet Quality, And One Lifecycle

Career-Ops keeps evaluation, its 1.0-5.0 score, explanation, useful liveness/provider behavior, PDF generation, and report artifacts. New transports or contextual agents call that single contract.

| Career-Ops score | Maxim tier | Default meaning |
| --- | --- | --- |
| Below 3.5 | T0 | No apply/reject |
| 3.5 to below 4.0 | T1 | Strategic override only |
| 4.0 to below 4.5 | T2 | Qualified apply |
| 4.5 through 5.0 | T3 | High conviction |

Connection/alumni/recruiter/founder/target-company signals are priority overlays. Top 20 percent is a daily attention overlay within T2/T3, not a replacement score band. Resume-review diagnostics and search similarity must not silently drive these tiers.

Keep confirmed NoVA/DC policy, default Maryland exclusion, Gainesville/Manassas inclusion, compatible multi-location allowance, salary thresholds/range rules, expected-salary review rules, and the no-active-clearance boundary. Unclear salary or eligibility is review work, not permission to guess.

Apply intent/readiness gates expensive research, tailored packets, and browser work. Track discovered, evaluated, intended, prepared, reviewed, user-confirmed submitted, and observed outcome as distinct concepts.

Hiring Panel may provide optional, user-requested critique before packet approval. Its seven reviewer perspectives plus ATS pass have real model cost. Cache against candidate/JD/resume revisions, show editable diffs and evidence, and never pass placeholders or invented metrics into a submitted PDF. Full panel is not a mandatory gate for every role.

Do not adopt Dossier's word/number heuristic fact guard as proof of candidate truth: its inspected implementation pools posting and candidate terms. Use source-linked candidate claims distinct from employer requirements, with explicit unknowns and user confirmation.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 9. Browser Assistance And Site Expansion

The user rejected the old Maxim planner/mapper/runner/navigation implementation. Retire it through an approved dependency inventory and data-preserving cutover, not by renaming it. Preserve native Playwright PDF/liveness functions and useful synthetic scenarios as requirements.

`agent-browser` is the preferred candidate for a bounded replacement spike: persistent sessions, accessibility snapshots/references, headed interaction, and a programmatic command surface are useful. It is not an answer memory, ATS policy engine, or evidence that every job site works.

The Maxim service must enforce:
- Per-session authority, allowed origins, bounded actions/timeouts/retries, fresh observations, and expected application identity.
- Shared fact/answer lookup, attachment approval, sensitive/unknown-field stops, and meaningful correction/recovery.
- Dedicated protected browser profiles and explicit login/account permission; no default attachment to a person's ordinary browser.
- A durable review point; no final submission command available to the agent. Enter keys, form events, confirmation steps, and network effects need tests, not only label matching.
- User control over MFA/challenges and final action. No CAPTCHA-solving providers, stealth/evasion plugins, concealed actions, arbitrary scripts, or privilege expansion from page text.

Start with representative Greenhouse and Lever forms. Then prove company/custom forms and Workday variants. LinkedIn/Indeed and other authenticated platforms remain desired future coverage, subject to their controls, terms, and explicit support evidence. Use manual fallback when unsupported; do not promise a brand-wide integration from one success.

Discovery, inspect, fill, upload, multistep navigation, login/session, pause/resume, manual review, and final action are separately described in the support matrix. Remote browser/handoff is a later explicit mode, not an implicit consequence of CDP support.

The LinkedIn connector proposed by the user does not provide job search, Easy Apply, inbox, or another person's live profile. Connection export import is a networking input, not an application adapter. Its optional social publishing tools are outside Maxim's intended scope.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 10. Follow-Through, Networking, And Interview Practice

### Gmail

Start with explicitly consented read-only job-related processing, source message/thread IDs, application correlation, uncertain-match review, and response tasks. A read-only mailbox grant can still expose broad mailbox content; filtering what Maxim processes does not narrow the provider grant by itself.

The product needs its own supported authorization/runtime arrangement. An assistant-connected Gmail account is not an installed repository integration. Do not add send/modify scope, automatic replies, or calendar access merely because Dossier has them. Handle revocation, retention, and private traces.

### Existing Discord

Reuse the Discord named **maxim applier**. That label does not establish guild/channel IDs, webhook ownership, bot permissions, or scheduler configuration.

Start with a configured private webhook for high-fit alerts, response reminders, and progress/digests if it meets the chosen interaction needs. Validate HTTP acceptance before marking a notification accepted; failed/429/unknown-outcome attempts remain visible and retryable under an explicit duplicate policy.

Schedules belong to the durable worker. Count confirmed submissions, not filled forms. An assistant bot connection remains separate from the repository webhook. Wearable queries are exploratory after dependable shared status APIs.

### Networking And Analytics

Preserve/adapt current contacts, recruiter threads, manual statuses, shortlist ranking, and person research into the same workspace. Import user-authorized connection exports or supplied research without requiring LinkedIn login. Keep strength 1-3 and job-specific explanations.

Draft structure remains person research, role reference, relevant candidate background, supported fit rationale, call to action. Xavier sends manually. No social-publishing or message-sending tool is added through connector adoption.

Primary analytics is interview rate among unique confirmed submitted NoVA/DC-compatible attempts in a declared cohort, with score/tier/source/lane/variant/networking/strength/freshness breakdowns and small-sample warnings. Discovered/evaluated records are not the denominator; unknown location/outcome is separate, and 0/0 is unavailable. Raw historical Interview Round is a high-trust signal; Application Status remains soft/raw until interpreted. Do not generate causal trend claims from tiny data.

### Optional Interview Lane

Adapt selected Cracked project-defense, behavioral/STAR, system-design, and company-prep workflows on top of Career-Ops interview prep and story bank. Read approved evidence and job context; persist practice sessions/feedback through canonical services rather than a second Markdown profile.

Treat community question banks as uncertain practice material, not guaranteed employer questions. Generated candidate answers remain drafts. Sandbox any candidate-code execution with explicit consent. Live assessment cheating is not the product. This lane can run after S3/S5 and does not block application assistance.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 11. Decision Register And Remaining Gates

| Area | Accepted | Recommendation or open detail |
| --- | --- | --- |
| Journey | Early dashboard/agent and useful onboarding; recruiter demo | Timed demo script, exact live scope |
| Storage | PostgreSQL/private artifacts/Compose target | Protected paths, versions, backup/restore and cutover mapping |
| Intake | PDF/DOCX/MD/TXT upload/review starting scope | Parsers/limits; local extraction then consented/redacted model interpretation |
| Runtime | One shared service/tool boundary; reconsider external references | Modular TS/Node + React 19 recommended; provider/model/toolkit not final |
| Memory | Confirmed facts, approved contextual answers, bounded retrieval and correction | Schema, sensitivity, numeric budgets, deletion/retention durations |
| Compatibility | Selective Career-Ops retention and deliberate retirement documented | Patch/write inventory, native projections, exact cutover evidence |
| Browser | Narrow visible pilot, later broader sites | agent-browser spike, site permissions, session storage, remote design |
| Final action | Human review/manual submission remains current policy | No autonomous final-action implementation in this roadmap |
| Discord | Existing maxim applier destination must be reused | Secret reference, exact channel, schedules, webhook vs interactive bot |
| Gmail/wearable | Email compatibility matters; glasses exploratory | Authorization/processing design; no wearable SDK selected |
| Dossier reuse | Valuable reference, not approved code transplant | Independent implementation recommended; AGPL-compatible reuse needs explicit decision |
| Other candidates | Evaluate/adapt only where useful | No runtime installation approved by merely listing a repository |

These are not all unresolved anymore. Do not re-open accepted direction as if no review happened, and do not silently promote recommendations into approvals.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 12. Development, Licensing, And Acceptance

EGM 0.1.1 is installed and enabled as the complete Codex plugin, including skills, reviewers, and standards. Use [the development workflow](development-workflow.md) to select context deliberately and request fresh-context reviews at its required human gates. Installation is not formal review or convergence; no formal EGM review is claimed here. This refinement used the EGM drift-report workflow and [recorded the code/design gaps](reviews/2026-11-16_DRIFT_REPORT.md).

Graphify can help source-only architecture analysis after an allowlist/privacy check. It is not the production candidate memory and must not ingest personal files, secrets, sessions, DBs, or private artifacts by default. Hermes is excluded from MVP unless a concrete gap justifies reconsideration.

For external code, record source revision, license/notices, dependencies, adaptation boundary, security review, and acceptance tests. Dossier's AGPL needs explicit review before copying; permissive licenses still require their notices. No automatic AGPL relicensing or broad package installation is enacted here.

A stage is accepted through a thin user-visible success path, meaningful failure/authorization/duplicate cases, data lineage, restart/recovery, and relevant regression checks. Native behavior changes only through approved, narrowly scoped adapters/cutovers. The [detailed stage specs](stages/README.md) now distinguish existing commands from proposed tests and define 92 acceptance cases. [Shared contracts](stages/contracts.md) and the executable roadmap validator check dependency/handoff consistency; they do not prove product behavior.

See [the roadmap](high-level-roadmap.md), [component assessment](external-components-assessment.md), and [operational checklist](operational-setup.md). The original commented workflow remains intact.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.

## 13. Miscellaneous Additions

Record additional ideas here with desired user benefit, evidence, risks, and proposed stage. They remain proposals until reviewed.

> **Comments**
>
> Add corrections, decisions, or additional requirements here.
