# MAXIM APPLY
# Career-Ops Fork Redesign
## Concept Definition and System Requirements
### Version 2.1 - Systems Architecture Second Pass
Prepared for Xavier Kubancik | 2026

Mission: Maximize the probability of receiving a high-fit Northern Virginia or Washington, DC job offer within 1 to 4 months by implementing Maxim Apply as a focused Career-Ops fork. Career-Ops remains the proven job-search engine. Maxim Apply becomes the Xavier-specific extension layer for orchestration, dashboard control, networking shortlist generation, recruiter tracking, analytics, Discord accountability, and future execution decisions.

This version supersedes v2.0 only where it clarifies architecture, module boundaries, source-of-truth rules, risk isolation, and implementation consequences. The core v2.0 redesign remains approved: Maxim Apply is a limited fork of Career-Ops, not a greenfield rebuild and not a separate CRM product.

## Document Map

- Part 1 defines the second-pass architecture decision, authority stack, and revised thesis.
- Part 2 defines the system primitives and black-box module boundaries.
- Part 3 defines the Career-Ops fork boundary, dashboard integration strategy, and data ownership rules.
- Part 4 defines scoring, routing, discovery, application, networking, recruiter, analytics, and notification requirements.
- Part 5 defines governance, risk controls, acceptance criteria, and implementation planning implications.
- Appendices preserve requirement traceability, architecture review findings, and definitions.

# Part 1 - Strategic Architecture Decision

## 1. Executive Architecture Decision

Maxim Apply will be built as a limited Career-Ops fork with isolated Maxim extensions. The fork exists because the dashboard and tracker experience should be unified inside Career-Ops rather than split into a separate product. The extension must remain surgical: preserve Career-Ops evaluation, scoring, PDF generation, scanner, apply assistant, tracker, and native dashboard behavior while adding Maxim-specific orchestration and views through clearly documented seams.

The system is therefore not a job bot and not a replacement for Career-Ops. It is a specialized control layer inside Career-Ops that adapts a proven open-source job-search engine to Xavier's high-urgency NoVA/DC job search.

```text
Career-Ops = evaluation, scoring, tailored PDF, scan, apply-assist, report, tracker, and dashboard base.
Maxim Apply = orchestration, priority flags, integrated command center, networking shortlist, recruiter tracking, analytics, notifications, and future execution controls.
```

## 1.1 Second-Pass Corrections

| Area | v2.0 Direction | v2.1 Clarification |
|---|---|---|
| Fork strategy | Limited fork | Limited fork plus explicit extension seams, merge zones, and upstream compatibility rules. |
| Career-Ops reports | A-G or A-F wording appeared inconsistently | Use neutral term `Career-Ops Evaluation Report`; do not rely on a fixed block count in Maxim interfaces. |
| Scoring | Career-Ops 1.0-5.0 drives tier | Keep Career-Ops score as primary fit source. Maxim may compute priority flags, but not a competing fit score. |
| Dashboard | Integrated Maxim mode | Dashboard screens must read through a dashboard service interface, not parse files or query SQLite directly. |
| Data store | Local SQLite extension store | SQLite is an implementation detail behind a `MaximStore` interface. Add an append-only event log for audit and replay. |
| User data | Career-Ops user layer remains source of user facts | User data must never be overwritten by upgrade or sync logic; Maxim may read and index it but must not mutate without explicit command. |
| Upstream updates | Preserve Career-Ops core | Maintain a documented patch boundary so upstream changes can be merged with minimal conflict. |
| Auto-submit | Deferred | Throughput remains a mission goal, but v2.1 achieves near-term leverage through Career-Ops apply assistant, prioritization, materials, and networking. Auto-submit requires a later separate design gate. |
| LinkedIn | No bot sending | Maxim may discover people, rank, research, draft, and notify. Xavier sends manually. No LinkedIn send APIs or bot actions in v1. |

## 1.2 Authority Stack and Precedence

| Priority | Authority | Meaning |
|---:|---|---|
| 1 | Latest confirmed user instruction | New user-approved decisions override prior assumptions. |
| 2 | This document: Maxim Apply v2.1 | Current project concept and system-level authority. |
| 3 | Career-Ops upstream behavior and data contract | Reused engine behavior should remain compatible unless intentionally and explicitly extended. |
| 4 | Job Search Command Center v1.1 | Preserved mission, guardrails, analytics, role-lane breadth, and preference context. |
| 5 | 50-question answers and later corrections | Binding configuration rules for NoVA/DC, salary, clearance, notifications, LinkedIn, and review cadence. |
| 6 | Senior Systems Architecture Consultant principles | Primitive-first design, black-box modules, wrapped dependencies, format discipline, and foundation-first implementation. |
| 7 | Maxim Applier greenfield roadmap v0.3 | Historical requirements source only where not superseded by Career-Ops fork decision. |

## 1.3 Design Doctrine

The system must be optimized for human maintainability and developer velocity, not merely for short-term feature count.

| Principle | Requirement |
|---|---|
| Primitive first | Define the stable information units before coding features. |
| Black-box modules | Each module exposes inputs and outputs only; internals can be rewritten. |
| One developer per module | A single developer should understand and maintain each module without needing the entire system in their head. |
| Dependency wrapping | Career-Ops, GitHub, Discord, Gmail, LinkedIn research, filesystem, SQLite, and AI providers must be accessed through adapters. |
| Source-of-truth discipline | A module may index another module's artifact but must not silently become the owner of that artifact. |
| Replaceability | Any Maxim extension can be rewritten from its interface contract without breaking the rest of the fork. |
| Foundation first | Fork authority, configuration, sync, store, tier router, and dashboard seam precede higher-level workflows. |
| No hidden automation | Relationship-sensitive and platform-sensitive actions must be explicit, visible, and auditable. |

# Part 2 - Core Primitives and Black-Box Boundaries

## 2. Core Primitives

Maxim Apply should be designed around a small set of semantic primitives. These are more important than any single file format or database table.

| Primitive | Meaning | Essential Operations | Owner |
|---|---|---|---|
| CareerOpsArtifact | Any report, PDF, tracker row, scan result, profile file, or output produced by Career-Ops. | read, parse, link, verify existence | Career-Ops Adapter |
| CareerOpsEvaluation | Parsed representation of a Career-Ops job evaluation, including score and report path. | parse, validate, sync, explain | Sync Adapter |
| MaximJob | A job enriched with Maxim tier, flags, source, action state, and dashboard-ready next action. | route, display, update status, link artifacts | Orchestration Layer |
| MaximTier | T0, T1, T2, T3 plus overlays that determine workflow. | assign, explain, override | Tier Router |
| PriorityFlag | A non-fit signal such as Fresh, NoVA/DC valid, Salary aligned, Connection path, Caution, or Needs review. | compute, display, clear, override | Policy Engine |
| CandidatePreference | Configurable criteria for location, salary, role lane, clearance, source, caution, and notifications. | load, validate, explain, update | Config Layer |
| EvidenceClaim | Candidate fact, skill, outcome, restriction, or story with approval and allowed-use metadata. | approve, reject, map, restrict | Evidence Layer |
| Contact | Person who may help with advice, referral, recruiting, or mock interviews. | import, rank, update, link to company/job | Contact Layer |
| NetworkingTarget | Job-specific person recommendation with ranking reasons and CTA. | generate, rank, explain, mark status | Networking Layer |
| MessageDraft | Ready-to-send LinkedIn/email draft with research basis, role context, and status. | create, preview, mark sent, track reply | Message Queue |
| ApplicationRecord | Planned/submitted application linked to report, PDF, score, tier, and outcome. | create, update, mark submitted, record outcome | Tracker Sync / Maxim Store |
| RecruiterThread | Email or conversation thread needing response, follow-up, or correction. | tag, clear, remind, audit | Recruiter Inbox |
| UserDecision | Manual approval, edit, override, tag correction, or status update. | record, replay, influence recommendations | Governance Layer |
| MaximEvent | Append-only record of a meaningful system or user action. | append, replay, audit, export | Event Log |
| MetricSnapshot | Daily or weekly measurement record used for learning. | compute, display, compare, recommend | Analytics Layer |

## 2.1 Primitive Design Rules

- Primitives describe what information means, not how it is stored.
- A primitive may be represented in Markdown, TSV, YAML, SQLite, JSONL, or Go DTOs as long as the semantic contract stays stable.
- Every user-visible decision must trace back to primitives: Career-Ops score, tier, flags, evidence, contacts, messages, outcomes, or user decisions.
- No dashboard screen should parse raw reports directly. Raw parsing belongs to the sync adapter.
- No notification should create its own business logic. Notifications consume already-computed action items.

## 3. Black-Box Module Boundaries

| Module | Inputs | Outputs | Must Not Know |
|---|---|---|---|
| Career-Ops Engine | CV/profile, JD/URL, portals.yml, mode prompts | reports, PDFs, tracker rows, pipeline entries | Maxim DB schema, Discord, recruiter inbox internals |
| Career-Ops Adapter | Career-Ops files and known file conventions | normalized CareerOpsEvaluation and artifact references | Dashboard rendering, notification delivery |
| Maxim Store | normalized objects, events, user decisions | queryable records, metrics-ready state | raw Career-Ops parsing details, UI layout |
| Tier Router | CareerOpsEvaluation, preferences, contacts, salary/location data | MaximTier, PriorityFlags, next action | dashboard keybindings, Discord implementation |
| Dashboard Service | Maxim Store records and DTO requests | dashboard DTOs | raw SQL, raw Markdown parsing, Career-Ops internals |
| Dashboard UI | dashboard DTOs and user key events | views, status changes, user decisions | report parsing, tier rules, notification policy |
| Networking Shortlist | job, company, contacts, research records, report summary | targets, ranking explanations, message work items | LinkedIn sending, dashboard rendering details |
| Message Builder | target, role, candidate positioning, template rules | message drafts | contact discovery, send mechanisms |
| Recruiter Inbox | imported/manual email thread records | thread status, response reminders | Gmail API details, notification rendering |
| Notification Planner | action items, urgency rules, batch schedule | notification jobs | Discord API details, dashboard internals |
| Notification Adapter | notification jobs | delivered Discord messages and delivery logs | tiering, analytics, recruiter classification logic |
| Analytics Engine | applications, outcomes, messages, scores, tiers, events | metric snapshots, recommendations | UI rendering, Career-Ops parsing |
| Historical Importer | raw XLSX/CSV tracker | raw rows, normalized records, import issues | scoring adjustments, dashboard layout |

## 3.1 Interface Discipline

Each module interface must answer five questions:

1. What primitive does it consume?
2. What primitive does it produce?
3. What external dependency does it wrap?
4. What state does it own?
5. Can it be rewritten using only this interface?

No module is accepted if it requires a developer to understand unrelated modules to make a safe change.

# Part 3 - Fork Architecture and Data Ownership

## 4. Career-Ops Fork Boundary

Maxim Apply is allowed to fork Career-Ops, but the fork must remain easy to rebase or merge from upstream. The key design tension is that Career-Ops dashboard code is system-layer code while Maxim needs to extend it. The resolution is to keep dashboard changes minimal and route all Maxim behavior through an isolated dashboard package.

## 4.1 Upstream-Preserved Zones

These should remain as close to upstream as possible:

- `modes/oferta.md`, `modes/scan.md`, `modes/apply.md`, `modes/pdf.md`, `modes/batch.md`, `modes/deep.md`, and other base modes.
- `generate-pdf.mjs`, `scan.mjs`, tracker integrity scripts, and PDF templates unless a specific defect requires patching.
- Career-Ops tracker conventions and file naming.
- Native Career-Ops dashboard screens and status controls.
- Career-Ops safety posture: no auto-submit, no LinkedIn sending, no anti-bot evasion.

## 4.2 Maxim Extension Zones

Maxim-specific behavior belongs in clearly named extension zones:

```text
maxim/
  config/
  lib/
  scripts/
  db/
  tests/
  fixtures/

dashboard/internal/maxim/
  model/
  screens/
  service/
  data/
  components/

docs/maxim/
  architecture/
  adr/
  testing/
```

The only acceptable direct edit to native dashboard routing is a small, documented integration hook that opens Maxim mode and delegates to `dashboard/internal/maxim`.

## 4.3 Patch Boundary Contract

| Patch Zone | Allowed Change | Risk Control |
|---|---|---|
| `AGENTS.md` | Add Maxim addendum under clearly marked section. | Keep upstream instructions intact. |
| `dashboard/main.go` or equivalent dashboard entry | Add mode switch/keybinding to Maxim mode. | No business logic in entry file. |
| `templates/states.yml` | Add states only if required for tracker compatibility. | Prefer Maxim-only states in SQLite unless Career-Ops tracker needs them. |
| `modes/_profile.md` | Xavier-specific profile and archetypes. | User-layer file, safe to customize. |
| `portals.yml` | Xavier target source configuration. | User-layer file, safe to customize. |
| `maxim/*` | All extension logic. | Owned by Maxim. |
| `dashboard/internal/maxim/*` | Maxim dashboard UI. | Owned by Maxim. |

## 5. Data Ownership and Storage Strategy

## 5.1 Source-of-Truth Table

| Data | Semantic Owner | Storage Representation | Write Rule |
|---|---|---|---|
| Source CV | User/Career-Ops user layer | `cv.md` | Never overwritten by Maxim. |
| User profile | User/Career-Ops user layer | `config/profile.yml`, `modes/_profile.md` | Only explicit user/config commands may modify. |
| Portal config | User/Career-Ops user layer | `portals.yml` | Maxim may generate suggested changes, then apply by explicit command. |
| Evaluation score/report | Career-Ops engine | `reports/*.md` plus parsed SQLite record | Career-Ops writes; Maxim indexes. |
| Tailored PDF | Career-Ops engine | `output/*.pdf` | Career-Ops writes; Maxim links and tracks usage. |
| Native tracker | Career-Ops engine/user layer | `data/applications.md` | Native scripts write; Maxim uses tracker-compatible write adapter only when needed. |
| Maxim orchestration state | Maxim extension | `data/maxim/maxim.db` | Maxim owns. |
| Audit history | Maxim event log | `data/maxim/events/*.jsonl` | Append only. |
| Historical import raw files | User/Maxim import | `data/maxim/imports/raw/` | Never modified after import. |
| Normalized historical records | Maxim extension | SQLite + normalized export | Maxim owns. |
| Networking queue | Maxim extension | SQLite + optional JSON export | Maxim owns. |
| Recruiter inbox state | Maxim extension | SQLite | Maxim owns. |
| Notifications | Maxim extension | SQLite + delivery logs | Maxim owns. |

## 5.2 SQLite and Event Log Decision

SQLite is appropriate for the extension store because Maxim needs relational queries across jobs, contacts, messages, recruiters, outcomes, and metrics. However, SQLite must remain behind a replaceable `MaximStore` interface.

The append-only event log is required because a mutable database alone is not enough for audit, replay, debugging, or trust. Meaningful events include:

```text
CAREEROPS_SYNCED
TIER_ASSIGNED
FLAG_ADDED
USER_OVERRIDE_RECORDED
MESSAGE_DRAFT_CREATED
MESSAGE_MARKED_SENT
RECRUITER_THREAD_TAGGED
APPLICATION_MARKED_SUBMITTED
OUTCOME_RECORDED
NOTIFICATION_SENT
METRIC_SNAPSHOT_CREATED
```

## 5.3 Format Design Rules

- YAML is for human-editable configuration.
- Markdown is for Career-Ops native human-readable reports and profile context.
- SQLite is for structured extension queries and dashboard state.
- JSONL is for append-only audit events.
- DTO structs are for dashboard rendering and should be stable enough that UI screens do not depend on storage internals.
- Raw historical imports must be preserved exactly before normalization.

# Part 4 - Functional System Requirements

## 6. Career-Ops Capability Adoption

| Career-Ops Capability | Maxim Decision | Notes |
|---|---|---|
| Job evaluation | Reuse | Career-Ops remains the fit evaluator. |
| 1.0-5.0 score | Reuse as primary tier source | Maxim adds orchestration flags but no competing fit score. |
| Evaluation report | Reuse | Parse what is available; do not bind Maxim to a fragile report block count. |
| Tailored PDF generation | Reuse | Maxim tracks which PDF was used and ties outcomes back to it. |
| Apply assistant | Reuse | Xavier edits/submits. No v1 auto-submit. |
| Portal scanning | Reuse and configure | Add Xavier-specific portals and target companies. |
| Batch processing | Reuse | Useful for volume evaluation. |
| Tracker | Preserve and sync | Career-Ops tracker remains native; Maxim adds structured extension state. |
| Dashboard | Fork and extend | Maxim mode is integrated into Career-Ops dashboard. |
| Contacto/message drafting | Reuse/adapt | Maxim owns person shortlist and message queue. |
| Interview prep/story bank | Reuse/adapt | Maxim dashboard links prep to interviews. |

## 7. Score-to-Tier Model

Career-Ops score determines the Maxim tier. Maxim's additional logic creates flags and priority ordering, not a competing fit score.

| Career-Ops Score | Maxim Tier | Meaning | Default Workflow |
|---:|---|---|---|
| `< 3.5` | T0 - No Apply | Below threshold or poor fit. | Log and hide from action queues unless manually reviewed. |
| `3.5 - 3.9` | T1 - Strategic Exception | Possible but not recommended by default. | Requires explicit reason such as connection, startup, unusual mission fit, or override. |
| `4.0 - 4.4` | T2 - Qualified Apply | Worth applying. | Generate application packet, show in apply queue, optionally create light networking shortlist. |
| `>= 4.5` | T3 - High Conviction | Strong match. | Urgent action, application packet, networking shortlist, and Discord alert if fresh. |
| Any plausible score plus strong connection | Connection Priority Overlay | Relationship changes expected value. | Add networking/referral workflow without changing fit score. |

## 7.1 Top-20 Rule

The original top-20 requirement remains but changes role. Top 20% no longer defines the tier. It determines daily attention priority inside T2, T3, and connection-priority roles.

```text
Tier = Career-Ops score.
Daily focus = tier + freshness + NoVA/DC + salary + connection strength + source + urgency.
```

## 8. Preference Configuration

The v2.1 rules reflect later confirmed instructions rather than older preference baseline conflicts.

| Category | Confirmed Rule |
|---|---|
| Location | NoVA and Washington, DC are allowed. Maryland is excluded by default. Gainesville and Manassas count as NoVA. Remote is allowed only for strong fit. |
| Salary | Global hard minimum is $85k. T3+ flat salary minimum is $90k. Salary ranges are acceptable when max is at least $95k and the range comfortably includes $90k, with lower bound at least $80k. |
| Clearance | U.S. citizen; no active clearance; has never held clearance; eligible and willing to obtain clearance. Never claim active clearance. |
| Role lanes | Broad software-building taxonomy. Do not over-bias discovery toward a narrow title list. |
| Positioning | "I am a computer science engineer from Virginia Tech with experience in full-stack software engineering, systems engineering, automation, and entrepreneurship." |
| LinkedIn | Use for research, target discovery, and manual-send drafts. Do not send messages by bot. |
| Notifications | Discord primary. Routine approvals batched. Fresh T2+ roles posted within two days alert immediately. |
| KPI | Interview rate percentage for NoVA/DC-compatible roles is primary. |

## 9. Integrated Dashboard Requirements

The Career-Ops dashboard becomes the primary interface. Maxim adds a mode or toggle rather than a separate web dashboard.

| Screen | Purpose | Required Actions |
|---|---|---|
| Native Career-Ops Pipeline | Preserve existing browsing, filtering, report preview, and status controls. | Continue using existing pipeline behavior. |
| Maxim Today | Show the work Xavier should do now. | Open role, mark done, open draft, mark sent, mark responded, view urgent. |
| High Conviction | Show T3, high-priority T2, fresh, and connection-priority roles. | Open report/PDF, view flags, start networking, mark applied. |
| Networking | Show ranked people and ready-to-send drafts. | Preview message, mark manually sent, mark replied, set follow-up. |
| Recruiter Inbox | Track recruiter threads and response commitments. | Mark responded, correct tag, schedule follow-up. |
| Applications | Track application lifecycle and outcomes. | Mark submitted, update outcome, link report/PDF. |
| Analytics | Track interview rate and patterns. | Review breakdowns and weekly recommendations. |
| Settings | Configure policies and toggles. | Edit batch times, flags, source priorities, contract toggle, notification options. |

## 9.1 Dashboard Architecture Rules

- Dashboard screens must consume dashboard DTOs, not raw files or raw SQL.
- The native Career-Ops dashboard must still build and run after every Maxim dashboard change.
- The Maxim mode must have graceful empty states for first-day use.
- Keyboard navigation must remain simple and documented.
- A broken Maxim screen must not prevent native Career-Ops pipeline view from opening.

## 10. Discovery Requirements

Career-Ops scanner remains the core discovery tool. Maxim configures it and adds orchestration around what gets attention.

| Requirement | Definition |
|---|---|
| Connection-company priority | Companies with Subjective Connection Strength Rating 3 are searched first. |
| LinkedIn role intake | LinkedIn can supply role links or person targets, but no automated LinkedIn actions are performed. |
| Y Combinator/startups | Startup discovery remains important because historical response has been strong. |
| Simplify and ATS sources | Use as discovery sources where practical. |
| Target company list | User-provided company list becomes search and dashboard input. |
| Freshness urgency | Fresh T2+ roles posted within two days trigger immediate Discord alert. |
| Deduping | Preserve source lineage while preventing duplicate action items. |

## 11. Application Workflow

Career-Ops apply assistant is the near-term application mechanism. Maxim's v1 workflow is assisted execution, not autonomous submission.

```text
Career-Ops evaluation and PDF
        -> Maxim tier and flags
        -> dashboard action queue
        -> Career-Ops apply assistant / prepared packet
        -> Xavier submits
        -> Maxim records submitted status, artifacts, source, score, tier, and outcome
```

## 11.1 Application Scope

| Stage | Status | Meaning |
|---|---|---|
| Stage 1 | Required for v1 | Assisted apply using Career-Ops answer drafting and user submission. |
| Stage 2 | Optional later | Semi-automated form support that pauses before submit. |
| Stage 3 | Deferred | Policy-gated auto-submit module outside Career-Ops core if data later proves it is still needed. |

## 12. Networking and Referral Workflow

Maxim accelerates networking without sending LinkedIn messages automatically.

```text
T2/T3 or connection-priority job
        -> identify possible people
        -> rank shortlist
        -> research person and company context
        -> draft message using five-part structure
        -> show as Ready to Send in dashboard
        -> Discord batch/urgent notification
        -> Xavier sends manually
        -> Maxim tracks sent, replied, referral asked, referred, declined, no response
```

## 12.1 Shortlist Ranking Signals

- Existing connection from user-provided list.
- Subjective Connection Strength Rating 1-3.
- Virginia Tech alumni.
- Recruiter associated with company or role family.
- Hiring manager or engineering manager.
- Senior engineer in FDE, automation, AI, GovCon, cyber, federal tech, startup, backend, or full-stack.
- Founder or founding team member for startups.
- Evidence of recent activity or public context usable for personalization.

## 12.2 Message Structure

Every generated intro draft should follow this order:

1. Research the person.
2. Mention the role.
3. Introduce Xavier's relevant information.
4. Explain why Xavier appears to be a good fit.
5. Provide a clear call to action.

Messages are drafts until Xavier sends them manually.

## 13. Recruiter and Email Workflow

Recruiter tracking remains a Maxim extension inside the dashboard.

| Feature | Requirement |
|---|---|
| Recruiter DM tag | A recruiter email/thread can be tagged as recruiter-related. |
| Needs Response tag | Threads needing attention must surface in dashboard and Discord. |
| Auto-clear on reply | Needs Response clears when a reply is recorded or manually marked. |
| Correction UI | Xavier can correct false tags and teach the system. |
| Personal email tracking | High-value personal-email actions can be manually logged even if the system does not manage that inbox. |

## 14. Analytics and Learning

Primary KPI: interview rate percentage for NoVA/DC-compatible roles.

Required breakdowns:

- Career-Ops score band.
- Maxim tier.
- Source.
- Role lane.
- Salary band.
- Freshness.
- Networking status.
- Connection strength.
- PDF/resume variant.
- Company type.
- Recruiter involvement.

Analytics must show small-sample warnings and recommend changes only when data is sufficient.

# Part 5 - Governance, Risks, and Acceptance

## 15. Safety and Truthfulness Guardrails

| Guardrail | Requirement |
|---|---|
| No fabricated candidate claims | Do not invent experience, titles, metrics, certifications, education, clearance, dates, or technologies. |
| No active clearance claim | Store active clearance as false and never imply otherwise. |
| AWS phrasing caution | AWS can be mentioned only with modest, evidence-supported language. |
| No LinkedIn bot sending | Drafts are prepared; Xavier sends manually. |
| No auto-submit in v1 | Application submission remains user-controlled in the Career-Ops-based version. |
| No anti-bot evasion | Do not bypass controls, CAPTCHA, or protections. |
| No duplicate damage | Avoid repeated submissions and duplicate follow-ups. |
| No opaque decisions | Every tier, flag, notification, and recommendation must explain why it exists. |

## 16. Architecture Risk Register

| Risk | Why It Matters | Mitigation |
|---|---|---|
| Upstream merge conflicts | Fork edits to Career-Ops dashboard can drift. | Minimize native dashboard changes; isolate Maxim in `dashboard/internal/maxim`; document patch zones. |
| Report parser fragility | Career-Ops report format may change. | Use tolerant parsing, fixtures, and fallback fields. Avoid hard dependency on report block labels. |
| SQLite coupling | UI could become tightly tied to database shape. | Use `MaximStore` and dashboard DTOs. Screens never run SQL. |
| Data ownership confusion | Career-Ops tracker and Maxim DB could diverge. | Define source-of-truth rules and sync events. Keep native tracker intact. |
| Scope creep into auto-submit | Prior automation goals could pull v1 off course. | Defer executor behind explicit evidence-based decision gate. |
| LinkedIn automation creep | Sending bots would create reputation/platform risk. | Safety tests prove no LinkedIn send module exists. |
| Notification fatigue | Too many alerts reduce responsiveness. | Routine batches; only fresh T2+ and recruiter urgent items alert immediately. |
| Analytics overfitting | Small samples can produce bad advice. | Small-sample warnings and recommendation thresholds. |
| Team cognitive overload | Mixing Go dashboard, Node scripts, SQLite, and prompts can become hard to maintain. | Clear module ownership, interfaces, and small feature boundaries. |

## 17. Consolidated v2.1 Requirements

| ID | Requirement | Definition |
|---|---|---|
| SYS-001 | Career-Ops fork foundation | Build Maxim as a controlled fork and extension, not a standalone replacement. |
| SYS-002 | Preserve Career-Ops engine | Do not rebuild evaluation, scoring, PDFs, scanner, apply assistant, tracker, or native dashboard behavior. |
| SYS-003 | Integrated dashboard | Add Maxim mode inside Career-Ops dashboard. No separate CRM in v1. |
| SYS-004 | Score-driven tiering | Career-Ops 1.0-5.0 score determines Maxim tier. |
| SYS-005 | Priority overlays | Maxim adds flags for freshness, location, salary, source, connection, caution, and urgency. |
| SYS-006 | NoVA/DC mission | System optimizes for Northern Virginia and Washington, DC job outcomes. |
| SYS-007 | Relationship-safe networking | Maxim discovers, ranks, researches, drafts, and queues outreach; Xavier sends LinkedIn messages manually. |
| SYS-008 | Historical import | Historical Google Sheet data is preserved raw and normalized separately. |
| SYS-009 | Recruiter tracking | Recruiter threads and Needs Response tasks are visible and auditable. |
| SYS-010 | Discord accountability | Urgent and batched notifications guide daily execution. |
| SYS-011 | Interview-rate analytics | Primary KPI is interview rate percentage for NoVA/DC-compatible roles. |
| SYS-012 | Evidence safety | Candidate claims remain grounded in approved evidence. |
| SYS-013 | Append-only events | Meaningful actions create auditable Maxim events. |
| SYS-014 | Replaceable modules | Each Maxim subsystem exposes interfaces and can be rewritten independently. |
| SYS-015 | Upstream compatibility | Fork changes are isolated so Career-Ops updates remain feasible. |

## 18. Acceptance Criteria for Project Description

The project description is acceptable when:

- It makes Career-Ops the foundation rather than a component to rebuild.
- It makes the existing Career-Ops dashboard the primary interface.
- It maps Career-Ops score directly to Maxim tiers.
- It preserves NoVA/DC, salary, clearance, role-lane, and evidence-safety requirements.
- It removes LinkedIn bot-sending from system scope.
- It defers auto-submit to a future decision gate without abandoning throughput as a goal.
- It defines stable primitives and black-box module boundaries.
- It separates semantic ownership from storage representation.
- It defines risk controls for upstream compatibility, data ownership, parser fragility, and notification fatigue.

## 19. Final v2.1 Concept Statement

Maxim Apply is a disciplined Career-Ops fork for Xavier's high-urgency NoVA/DC job search. It keeps Career-Ops as the engine for evaluation, score, scan, PDF generation, application-answer drafting, tracker artifacts, and dashboard foundation. Maxim adds a focused extension layer: score-to-tier orchestration, priority flags, integrated command-center dashboard mode, historical analytics, connection-aware networking, ready-to-send outreach drafts, recruiter tracking, Discord accountability, and event-based governance.

The system is intentionally designed as a long-lived, maintainable fork. Career-Ops remains the proven base. Maxim adds only the pieces that create Xavier-specific leverage.

# Appendix A - Requirement Traceability

| Original Requirement | v2.1 Treatment |
|---|---|
| Majority autonomy | Preserved for discovery, scoring, preparation, tracking, reminders, and drafting. Auto-submit is deferred. |
| High-volume applications | Modified to assisted high-throughput via Career-Ops packets and dashboard execution. Future executor requires gate. |
| Top 20% high-touch | Preserved as daily attention priority inside T2/T3/connection-priority roles. |
| Evidence-backed materials | Preserved through Career-Ops profile/CV plus Maxim evidence restrictions. |
| Connection/referral advantage | Strengthened through shortlist and ready-to-send queue. |
| LinkedIn outreach automation | Replaced by manual-send drafts to reduce risk and wasted development effort. |
| Analytics and learning | Preserved and centered on interview rate percentage. |
| Separate CRM dashboard | Removed; replaced by integrated Career-Ops dashboard mode. |
| Career-Ops reuse | Now foundational. |

# Appendix B - Architecture Review Findings

| Finding | Design Response |
|---|---|
| v2.0 described a fork but needed sharper patch boundaries. | v2.1 adds upstream-preserved zones, Maxim extension zones, and patch boundary contract. |
| Dashboard can become tightly coupled to SQLite. | v2.1 requires dashboard DTOs and service interfaces. |
| Report parsing may break when Career-Ops changes formats. | v2.1 avoids hard-coded A-F/A-G block dependence and requires tolerant parser fixtures. |
| SQLite alone is not enough for auditability. | v2.1 adds append-only event log. |
| Auto-submit pressure could distract v1. | v2.1 explicitly gates it as a future executor decision. |
| Link between architecture principles and implementation was implicit. | v2.1 makes primitive-first, black-box, dependency wrapping, and format design rules explicit. |

# Appendix C - Source Basis

This document is based on the approved Career-Ops fork redesign, the Job Search Command Center v1.1 requirements, the user's 50-question answers and later corrections, the Senior Systems Architecture Consultant principles, and current public Career-Ops documentation.
