# Maxim Apply: Current User Workflow And Data Flow

Reviewed: November 16, 2026.
Status: Current-state explanation for Xavier's comments, not an approved redesign or sprint plan.

## 1. How To Use This Document

Read from intake onward to follow the actual user journey. Add comments under the numbered sections, especially where the current behavior differs from the desired product. After review, those comments should drive a revised roadmap README. The earlier sprint proposal is not assumed to be approved.

Evidence labels used here:
- **Code:** behavior found in the inspected repository implementation.
- **Instructions:** behavior requested by agent prompts/documentation, not necessarily enforced by executable code.
- **User-reported:** information supplied about the separate web stack, not independently traced through its source.
- **Unknown:** a connection or capability not established by this inspection.

Repository inspected: `D:\VSC Programs\maxim-apply`. No private profile values or credentials are reproduced here. No applications were submitted, emails read, or services started for this document.

> **Comments - Section 1**


## 2. The Short Answer: How Does A User Give The System Information?

Today, this is primarily a file-based, agent-assisted system, not a completed onboarding web application.

A user can tell the coding agent about their background or provide a resume. Career-Ops instructions tell the agent to turn that input into local profile and evidence files. The user can also edit those files directly. Later commands read those files. The conversation itself is not a durable, automatically indexed candidate database.

There are two distinct consumers:
1. The Career-Ops AI workflow reads narrative context and evidence to evaluate roles and draft materials.
2. The Maxim standalone form filler reads specific structured profile fields and environment variables to fill recognized form controls.

Giving the agent a fact in conversation does not prove that either consumer can use it later. The agent must save it into a source that the appropriate consumer actually reads.

### Example Of The Actual Intake Boundary

Suppose the user says: 'My phone number changed.'

- The agent can update `candidate.phone` in `config/profile.yml`.
- If `MAXIM_CANDIDATE_PHONE` remains set in the process environment or loaded from `.env`, that override still wins for browser filling.
- Updating the CV alone does not update the structured phone answer used by the filler.
- A browser run already in progress holds its loaded plan; changing a file does not automatically replace values in that live plan.
- There is no general approval/versioning workflow that reconciles these copies for the user.

**Comment space:** What should users provide initially, and which information should be required versus optional?

> **Comments - Section 2**
>It's no clear how the local profile and evidence files work here. The knowledge system needs be comprehensive but not cost a lot for agents to use. From the example, it sounds like there are two distinct systems and not one harmonous system. Canidate information isn't effienently stored 

## 3. Personal Information: Files, Ownership, And Readers

| Input | Current purpose | How it is populated | What consumes it |
| --- | --- | --- | --- |
| `cv.md` | Canonical narrative CV: roles, dates, projects, education, skills | User or agent converts reviewed resume information to Markdown | Career-Ops evaluation, drafting, and resume workflows |
| `config/profile.yml` | Structured identity, targeting, narrative, compensation, and application answers | User edits or agent writes YAML | Career-Ops context; Maxim profile loader reads selected keys |
| `modes/_profile.md` | Personal archetypes, positioning, preferences, narrative overrides | Agent-assisted personalization or direct edit | Career-Ops mode context and Gemini evaluation |
| `article-digest.md` | Additional portfolio evidence and proof points | User/agent-curated evidence | Agent workflows that load it; not a universal input to every script |
| `.env` / process environment | Secrets and selected private answer overrides | Local user setup | Scripts importing dotenv; explicit environment lookups |
| `portals.yml` | Discovery companies, URLs, search queries, title/location filters | User/agent configures search | Standalone scanner and agent scan instructions |
| `data/maxim/imports/raw/` | Preserved imported source material | Import commands or local intake | Relevant importers; resume fallback discovery checks one subdirectory |

These files are not interchangeable. The browser filler does not parse arbitrary prose from the CV or portfolio to answer every form question.

Career-Ops' data contract distinguishes user-owned personalization from updatable system files. Personal details belong in the user layer, not hardcoded into generic mode instructions or shared scripts. See [DATA_CONTRACT.md](../DATA_CONTRACT.md).

### What Onboarding Instructions Actually Say

`AGENTS.md` instructs the agent to check for `cv.md`, `config/profile.yml`, `modes/_profile.md`, and `portals.yml`. Missing basics trigger onboarding guidance. The agent is instructed to request a CV/background, identity, location, target roles, salary preferences, and proof points, and write the relevant local files.

This is an agent procedure. It is not proof of an implemented form wizard, upload service, schema-complete validation endpoint, or approval UI. Instructions can be followed inconsistently across sessions and agent tools.

The public `config/profile.example.yml` illustrates general Career-Ops settings. It is not a complete schema for all Maxim application-answer keys.

### Structured Fields Read By The Browser Profile Loader

Source: [auto-apply-planner.mjs](../maxim/lib/auto-apply-planner.mjs), `loadAutoApplyProfile`.

- Identity: `candidate.full_name`, email, phone, location, street_address, city, state, postal_code, country, linkedin, portfolio_url, github.
- Education: `education.school`, `field_of_study`, `degree`.
- Positioning: `narrative.approved_positioning`; this is included in the plan, not automatically inserted into arbitrary essay fields.
- Authorization: `application_answers.work_authorization.us_citizen` and `requires_sponsorship`; citizenship has a fallback to the clearance section.
- Clearance: `application_answers.clearance`, with fallback to top-level `clearance`; active_clearance, eligible_to_obtain, willing_to_obtain.
- Availability: `application_answers.start_date.default_answer`.
- Salary: `application_answers.expected_salary` contains text_answer, numeric_default_minimum, and high_fit_numeric_if_supported.
- Relocation: `application_answers.relocation.open_to_relocating`.
- SMS: `application_answers.communication.sms_consent`.
- Standard questions: `application_answers.standardized` supplies application_source, previous_employer_relationship, conflict_of_interest, export_control_restrictions, and us_person.
- Voluntary self-identification: `application_answers.self_identification` supplies default_answer and category-specific choices.
- Resume: `cv.default_resume_pdf_path` can select a local PDF fallback.

For YAML boolean answers, actual booleans matter: use `true` or `false`, not arbitrary explanatory text. Unknown/missing values generally remain blank and are held for review.

### Environment Overrides

Supported variables include `MAXIM_CANDIDATE_FULL_NAME`, `MAXIM_CANDIDATE_EMAIL`, `MAXIM_CANDIDATE_PHONE`, address fields, LinkedIn, portfolio, GitHub, `MAXIM_RELOCATION_OPEN`, `MAXIM_SMS_CONSENT`, standardized-question variables, and `MAXIM_SELF_ID_*`.

For supported text fields, a nonempty environment value takes precedence over YAML. Selected environment booleans accept recognizable yes/no forms; otherwise YAML is used. The scripts import `dotenv/config`; running from the repository root avoids confusion about which local `.env` is loaded. An already-set process variable normally takes precedence over dotenv's default loading.

There is not one universal precedence chain for every personal fact. Only keys explicitly handled by the loader receive these overrides.

### How A User Checks Setup

From the repository root:

```powershell
npm run maxim:auto-apply -- doctor
```

This reports the presence of required/recommended fields without printing their configured private answers. Email and phone are required by this readiness check. LinkedIn and other fields are recommended. Passing this check does not establish factual accuracy, resume approval, form compatibility, or a working browser session.

Do not put real values in shared examples or commit them. The relevant files include ignored local paths, but ignore rules alone are not a privacy audit of all files and generated outputs.

> **Comments - Section 3**
>The personal information sources make sense to  me but the information seems like its repeated across multiple sources.  Also, I don't see where answers to novel questions are stored that job forms may ask. Additionally, I don't believe this  the most efficient means for infomration storage. Investigate the approach used for data storage and determine if a more harmonous approach should be used. I will later expan on this section at the end of this document because much could be improved with the curation of this information. I really like the data contract.md file  organization .       
> Lets get rid of all of the auto applier logic for now. This was done in a rushed way and doesn't work well. 

## 4. What Is Remembered Today?

### Persistent Reuse That Exists

Structured values in the local profile/environment are reread for later plans. Career-Ops reports can retain job-specific draft/final answers when the agent updates them. Imported contacts and workflow records can persist in SQLite.

### Automatic Learning That Does Not Exist

The inspected browser runner does not:
- Save every question and human answer into a searchable approved-answer library.
- Read the user's completed form back into the profile after review.
- Persist a user's browser corrections as new approved defaults.
- Apply semantic matching across arbitrary previously answered essay questions.
- Track per-answer approval, employer scope, expiry, revocation, or source evidence as a general mechanism.

Career-Ops `apply` instructions say to reuse previous report answers and optionally update the report after submission. That is a job-report/agent workflow, not a general executable answer-memory service.

Important distinction: code calls these values 'known' or 'approved,' but loading a configured value does not prove the existence of a recorded human approval. Broad defaults such as previous-employer relationship can be wrong for a particular company.

**Comment space:** Which answers should persist automatically, which require approval, and which must always be contextual?

> **Comments - Section 4**
>Memory needs greatly revamped in an intelligent way that is efficent and optimial for this project. Agents need to be able to retreive this information without burning more tokens than is needed. 
> The current browser runnner is garbage and needs to be redesigned.  
Career-Ops `apply` instructions are good but clearly don't meet my use case


## 5. Storage: Where Each Kind Of State Lives

| Layer | Current storage | Meaning |
| --- | --- | --- |
| Candidate context | Markdown/YAML/environment files above | Inputs used by different readers; not automatically unified |
| Discovered job inbox | `data/pipeline.md` | Pending role URLs for evaluation |
| Discovery deduplication | `data/scan-history.tsv` plus existing tracker/inbox checks | Seen-job history, not proof of application |
| Evaluation | `reports/*.md` | Career-Ops fit reasoning, score, role details, and possibly draft answers |
| Application artifacts | `output/*` | Generated resume/PDF and related files |
| Native tracker | `data/applications.md` | Career-Ops human-readable application state |
| Maxim extension | `data/maxim/maxim.db` | Structured jobs, evaluations, applications, contacts, drafts, recruiter threads, notifications, metrics |
| Audit history | SQLite audit rows and `data/maxim/events/*.jsonl` | Events explicitly appended by participating commands |
| Browser-run output | `data/maxim/auto-apply-runs/*.json` with `--write-report` | Run summary and review checklist, not an approved answer library |
| Existing web backend | User reports a backend database | Ownership and synchronization with these files/store remain unverified |

The extension store uses a Node wrapper that invokes Python's standard `sqlite3` module. It therefore needs Python as well as Node. See [sqlite-store.mjs](../maxim/lib/sqlite-store.mjs) and [schema.sql](../maxim/db/schema.sql).

Local-first does not mean encrypted at rest. Filesystem/database access still exposes stored information. Generated reports and logs should be treated as private even when some fields are redacted.

The audit log is append-only at the code-operation level, not tamper-proof storage. Database writes and JSONL appends are not one cross-file atomic transaction. Do not assume every manual file change creates an event or that complete replay/recovery has been proven.

> **Comments - Section 5**
>This system needs to be more harmonous. Career ops is a great start but I need to make it my own for the purposes of this system. THe excessive use of markdown files for information that should be stored in a more efficent way is unacceptable. For example, applications.md should be a database table in container. I will detail browser interaction at a later point.
> Add your comments here.

## 6. Discovering Jobs: Standalone Scanner Versus Agent Search

The user configures `portals.yml`, then chooses either the executable scanner or the broader agent workflow.

### Standalone Command

```powershell
npm run scan
```

The scanner loads provider modules from `providers/`, selects a provider for supported enabled companies, fetches jobs, applies filters/deduplication, and writes eligible new candidates to the inbox/history. `--dry-run` avoids scanner output writes but can still make network requests. Optional verification checks posting liveness.

Provider modules exist for Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, and local executable parsers. A parser entry is only usable when its required local script/configuration exists. Provider-specific networking has timeouts and some bounded retries; their existence is not a blanket reliability guarantee.

Prior November 16 offline audit: 237 configured companies, 224 enabled, 5 matched a provider, 219 enabled but unmatched. These counts reflect that configuration at audit time, not today's live postings or total theoretical provider coverage.

### Agent Workflow

`/career-ops scan` routes through agent instructions that describe additional browsing, API access, and web-search discovery. Actual coverage depends on the agent's available tools, permissions, execution, and sites. A YAML `scan_query` or `scan_method: websearch` is not automatically executed by the standalone Node scanner.

Discovery does not mean evaluation, and evaluation does not mean application. A result can be discovered through LinkedIn or a search engine while its actual application destination is a different ATS.

**Comment space:** Which sources matter, and should coverage be automatic, agent-assisted, or explicit user intake?

> **Comments - Section 6**
> I somewhat agree with this approarch used by portals.yml. some providors are easier to submit applications with than others. For example, linkedin and workday are harder to fill out than greenhouse. What matters most here is that there isn't a blindspot for new jobs that are posted which could be high fit. For example, if a tracked company posts a new job on their own site  and the scanner can't find it, that is an issue.


## 7. Evaluation And Application Packet Preparation

A user can supply a job URL/JD to Career-Ops or process inbox URLs through its pipeline modes. The agent uses candidate context and evaluation instructions, produces a report and score, and may generate a tailored PDF depending on the workflow and configured score threshold.

A separate wrapper is available:

```powershell
npm run maxim:evaluate-job -- <job-url-or-saved-jd-file>
```

Its implementation materializes readable JD text, invokes the Gemini evaluator, and runs downstream tracker/sync/reporting steps. It is not simply another name for a Claude Code session. Its evaluator requires `GEMINI_API_KEY`; URL extraction uses ordinary HTTP/text extraction and can fail on dynamic pages.

The inspected Gemini evaluator loads `cv.md`, `config/profile.yml`, `modes/_profile.md`, and relevant mode instructions into its model prompt. Local storage does not prevent selected candidate context from being sent to the configured model provider for evaluation.

Different routes have different context readers and PDF behavior. Do not assume every evaluation command reads every evidence file or always creates a ready-to-attach PDF.

### Syncing Career-Ops Output Into Maxim

```powershell
npm run maxim:sync
```

The adapter discovers reports/PDFs/tracker artifacts, parses reports, links PDF paths, computes tier/policy flags, and upserts structured records. Tracker rows are imported and enriched from matching evaluations. Malformed reports can produce warnings and be skipped.

Tier mapping:
- Score below 3.5: T0.
- 3.5 through 3.9: T1.
- 4.0 through 4.4: T2.
- 4.5 and above: T3.

Policy flags add location/salary/clearance/freshness/connection context rather than a competing fit score.

This is an explicit sync command, not a demonstrated continuous two-way replication service. It does not establish synchronization with the separate web API. Artifact matching and repeated sync/status preservation require scrutiny; stable upserts do not prove every possible merge is correct.

> **Comments - Section 7**
>This wrapper seems like a bad add on. I'm not sure if this is the ideal apprach having two agentic systems. These multiple routes are cumbersome and bloated. I shouldn't need to run a sync because there shouldn't be two disjoint systems. Career ops also has its own scoring system so We need to look into how to combine   the logic into one harmonous system. I like what career ops has done with scoring  as a baseline.  The poliy flags are a good touch but seem like a workaround.  

## 8. From Evaluation To An Application Plan

```powershell
npm run maxim:auto-apply -- prepare --limit 5
npm run maxim:auto-apply -- plan --limit 5
npm run maxim:application -- list
```

`prepare` syncs/queues work and can change extension state. `plan` builds plans for stored applications; `--record` explicitly adds plan audit events. These commands do not submit an application.

Queueing normally targets T2/T3 evaluations. Applications can be held for missing packets, duplicate risk, or ineligible tier/status. Plans include role URL, score/tier, attachment/report paths, known answers, blockers, and suggested commands.

Current readiness checks include:
- An accepted application status.
- T2/T3 tier.
- A report and an attachment path.
- A job URL.
- No high duplicate risk.
- Required contact fields.
- No enabled final-action policy.

A 'ready' plan is not proof every required form field can be filled, that a posting is open, or that policy/attachment approval is fully validated.

### Resume Selection Caveat

The current planner prefers a linked tailored PDF; otherwise it can use a configured fallback or discover a resume-like PDF under `data/maxim/imports/raw/resume_sources/`. Discovery favors names containing 'final' and then modification time. That is a filename heuristic, not human approval.

There is a failing regression test expecting a legacy/unapproved fallback not to be offered to the mapper, while another existing planner test permits fallback use. This inconsistency must be resolved before calling attachment approval reliable.

The packet code also uses path presence for parts of readiness; the file upload step separately checks whether the attachment exists. A ready flag is not complete artifact validation.

> **Comments - Section 8**
>Post evaulation, I agree that this phase exists so resources aren't wasted on jobs the user won't ultimately apply for. Auto application as a principal is acceptable for high fit jobs but The current system needs reworked from the ground up using a revised workflow and features.  
> Add your comments here.

## 9. Two Different Ways To Assist With An Application

### A. Native Career-Ops Agent Mode

`/career-ops apply` loads `modes/apply.md` through the skill router.

Its instructions describe identifying the active job, locating its report, detecting visible questions, using previous report answers/CV evidence, and presenting personalized answers. With browser tooling the agent can inspect the page; without it the user supplies screenshots or questions.

The documented core output is answers for copy/paste. After the user confirms submission, the agent is instructed to update the native tracker and possibly report answers. Tool availability and agent execution determine what actually happens.

The router does not automatically delegate `apply` to the Maxim standalone browser CLI. These are separate paths today.

### B. Maxim Standalone Browser Runner

```powershell
npm run maxim:auto-apply-browser -- inspect <application-id> --headed --write-report
npm run maxim:auto-apply-browser -- assist <application-id> --headed --record-started --write-report
```

`inspect` does not fill candidate fields, but it can navigate and click an application launcher. It is not a zero-interaction page read. `assist` applies mapped values. Both require a stored application and URL; unready plans are normally refused.

The browser runner itself makes no model call to interpret arbitrary form questions. It uses deterministic extraction, regex classification, predefined answers, and Playwright actions.

**Comment space:** Should the user experience unify these two paths, and what control should the user retain?

> **Comments - Section 9**
>These seperate paths are inefficent and this subsystem needs changed. The Maxim functioanlity for this should be removed because its the wrong direction for this route. I will implement this at a later stage properly.
> Add your comments here.

## 10. Browser Navigation: What Actually Happens

Source: [auto-apply-browser.mjs](../maxim/scripts/auto-apply-browser.mjs).

### 10.1 Launch And Session

The runner launches a new Chromium instance and a new page for the run. It does not attach to the user's ordinary Chrome tab or reuse a stored login profile. Headless is the default; `--headed` makes it visible.

The runner navigates to the stored job URL with a 45-second navigation timeout and waits for page loading/network quiet with bounded waits.

If no form fields are visible, it looks for an anchor/button containing 'apply,' excludes some final-action words, and clicks a candidate launcher. It can follow a popup/new tab and inspect embedded frame fields.

This is a heuristic, not an ATS-specific navigation model. It does not establish that every control containing 'apply' is harmless, or that a page with a search box already visible will reveal the application form correctly.

> **Comments - Section 10.1**
>Remove all of the current browser navigation features mentioned in this section. They are inefficent and I will rebuild them at a later point
> Add your comments here.

### 10.2 Stop-Page Detection

The code checks body text for CAPTCHA/human verification, sign-in/login, and selected closed/404 signals. These are simple string rules, not a complete challenge, authentication, or liveness classifier.

A generic 'Sign in' link can cause a false positive; an unfamiliar challenge or closed-page wording can be missed. The runner does not solve challenges or authenticate users. Initial form-reveal navigation occurs before the per-step stop check.

> **Comments - Section 10.2**
>
> Add your comments here.

### 10.3 Per-Step Loop

Default maximum: four steps, adjustable with `--max-steps N`.

At each step it:
1. Detects known stop conditions.
2. Extracts controls from page frames.
3. Maps controls to known-answer categories.
4. In assist mode, attempts fillable fields if no stop condition was found.
5. Collects final-action controls and records individual fill failures.
6. Stops on a platform/posting condition, inspection completion, or required-review fields.
7. Otherwise looks for an allowlisted Next/Continue control and clicks it.
8. Repeats until no continuation is found or the step cap is reached.

It pauses between actions and has bounded action waits. It does not implement an unlimited autonomous browser agent or reliable general recovery from every dynamic site change.

> **Comments - Section 10.3**
>This is inefficient and should be removed.
> Add your comments here.

> **Comments - Section 10**
>
> Add your comments here.

## 11. How Fields Are Identified And Filled

### 11.1 Extraction

The runner reads native `input`, `textarea`, and `select` elements in frames. It gathers IDs, names, types, labels, group legends/ARIA labels, placeholders, nearby text, required/disabled/read-only flags, visibility, and select options.

Nearby-text extraction is deliberately bounded, but proximity is still an inference. Arbitrary custom widgets that do not expose the expected native controls are not generically supported.

> **Comments - Section 11.1**
>
> Add your comments here.

### 11.2 Classification

The mapper checks sensitive/self-ID categories and an ordered list of regex rules. It then retrieves the corresponding known answer.

Examples include names/contact links/address, school/major/degree, relocation, authorization/sponsorship, clearance, availability, salary, SMS, source, employer relationship, export controls, and resume upload.

This is first-match rule classification, not semantic understanding. Overlapping labels can map incorrectly. For example, broad name/security-clearance rules deserve scrutiny for employer-name or clearance-willingness questions. One rule for being currently located in the US returns 'Yes' directly rather than consulting a separate approved answer. Safety intentions do not eliminate these code-level assumptions.

> **Comments - Section 11.2**
>
> Add your comments here.

### 11.3 Actions

| Control | Current action | Limitation |
| --- | --- | --- |
| Text/textarea | Playwright fill with the mapped value | Does not draft arbitrary role-specific prose |
| Native select | Match known option labels/values; selected aliases such as US/United States and Yes/No | Ambiguity or custom combobox behavior can defeat matching |
| Radio/checkbox | Group options and choose a matching approved answer | Text/token matching is not universal choice comprehension |
| Resume file input | Attach the selected local file | Wrongly selected or unapproved resume remains a risk |
| Styled hidden upload | Can attach when the input is hidden but not inside a hidden future-step container | Not every drag/drop or upload widget is supported |

Locator preference is stable field ID, choice name/value, unique name, then extracted DOM index. Index fallback and frame-index identity can become stale if the page changes dynamically.

Typed native fields receive basic format checks for date/month/number/email/URL. These are not complete business-rule validators. 'Two weeks notice' is not automatically converted into a specific date.

> **Comments - Section 11.3**
>
> Add your comments here.

### 11.4 What Is Held Or Skipped?

- Unknown required and optional questions are returned for review rather than generated automatically.
- Cover letters are held for role-specific review.
- Missing configured answers are held.
- Disabled/read-only and most hidden helper controls are skipped.
- File fields in hidden future steps wait for that step.
- Voluntary self-ID fields with no configured answer are held.
- Explicit self-ID category/default values can currently be mapped and filled; a general claim that all self-ID always stops for manual review would be inaccurate.
- Some unlabeled/unaddressable fields are skipped, which means the runner cannot guarantee that every required question has been recognized.

A fillable classification is not the same as successful filling. Per-field failures are reported. The loop's continuation gate uses mapped required-review count; failures do not by themselves constitute a complete validation/retry/recovery policy.

> **Comments - Section 11.4**
>
> Add your comments here.

### 11.5 Salary Is Especially Important

The policy engine contains salary reasoning, but the standalone planner currently chooses the configured high-fit numeric value for T3 when present, otherwise the default numeric value. Its mapper prefers that numeric answer over salary text when available.

Do not assume the browser path automatically computes the posted-range median, checks that a T3 salary is supported, or chooses the best text answer for every field merely because those rules appear in product documentation.

> **Comments - Section 11.5**
>
> Add your comments here.

> **Comments - Section 11**
>
> Add your comments here.

## 12. How Broad Is Site Support?

There is one generic form runner, not a tested adapter for every job platform.

| Site/application shape | Current evidence and limitation |
| --- | --- |
| Greenhouse | Historical implementation log describes a real-form guided-fill check; current fixtures prove selected behaviors, not universal/current Greenhouse compatibility |
| Lever | Discovery provider exists; historical removed-posting inspection is not proof of a successful end-to-end live application |
| Ashby, Workable, SmartRecruiters, Recruitee | Discovery providers exist; no platform-wide application coverage follows from that |
| Workday/account-heavy portals | No dedicated login, tenant navigation, or full repeated work-history-entry adapter established |
| LinkedIn Easy Apply / Indeed-hosted application | No dedicated supported application adapter established in inspected code |
| Embedded iframe form | Covered by browser fixture |
| Popup launcher | Covered by browser fixture |
| Native multi-step form | Covered by fixture for selected safe continuation controls |
| Rich custom widgets, repeated employment entries, signature/consent flows | Require manual handling or further explicit implementation/validation |
| CAPTCHA, login, access control | Pause/manual handling; no bypass support |

Coverage must be described per real form and control type, not just the website brand. A new site's native fields may work, while another form on a familiar ATS may not.

> **Comments - Section 12**
>This is unacceptable and needs expanded in the future
> Add your comments here.

## 13. Review, Submission, And Browser Handoff

The runner collects final controls whose text matches selected words such as submit/send/finish/complete/apply now. It does not intentionally execute final submission. Next/Continue controls are allowlisted by text.

However, button labels alone do not prove network side effects. There is no general interception layer proving that every launcher/continuation action cannot submit. Negative submission tests and site-specific checks matter.

Current handoff limitations:
- Headless runs close the browser at the end, so they cannot provide an interactive human-review window.
- Headed runs avoid explicit closing unless `--close` is used.
- The CLI then calls `process.exit`; there is no explicit wait-for-user confirmation loop or persisted resume session.
- Therefore, leaving the browser reliably available, correcting fields, and resuming the same session must not be treated as a completed workflow.
- A rerun launches a new session. User edits are not automatically captured and replayed as approved answers.

The returned `ok: true` means the run returned its structured result; it can still have stop reasons, review fields, and failures. It does not mean ready-to-submit or successfully applied.

> **Comments - Section 13**
>remove
> Add your comments here.

## 14. Tracking After The Browser Run

`--record-started` records assisted-started only when the run is okay, has no reported platform/posting stop reason, and at least one field was actually filled. It does not mark submitted.

After the user actually submits:

```powershell
npm run maxim:application -- submitted <application-id>
```

That command changes the extension application record and appends an event. It trusts the user's command; it does not verify an ATS confirmation or inspect an inbox receipt.

The native Career-Ops agent can separately update `data/applications.md`. The inspected Maxim CLI mutation does not itself write that Markdown tracker. This is a potential divergence: an extension submitted state and native tracker state are not automatically guaranteed to agree.

Duplicate detection uses available company/role/URL/job identity signals. Heuristics are not proof of duplicate/nonduplicate status; same-title distinct openings and missing identifiers need review.

The presence of `data/maxim/application_outcomes.csv` is not proof it is automatically ingested. The inspected analytics path did not establish automatic consumption of that CSV. Any outcome workflow must name the actual importer/reader rather than relying on a template's existence.

> **Comments - Section 14**
>remove
> Add your comments here.

## 15. Dashboard, Email, Discord, And Other Workflows

### Native Dashboard

The Go terminal dashboard has a Maxim mode. Node commands export dashboard DTO snapshots; the Go service consumes a snapshot with native tracker fallback behavior. Refreshing generated state is distinct from continuously synchronizing all stores. Maxim write actions remain primarily CLI-backed.

### Existing Web Dashboard: User-Reported

Frontend: <http://127.0.0.1:3000/maxim>.
Backend: <http://127.0.0.1:8000>.

Xavier reports jobs/application/review/settings/orchestration API data and some mock fallback on failed requests. This document has not located or traced that frontend/API source. It cannot assert how profile onboarding, browser execution, or storage are connected there. Backend health is not proof of fresh Career-Ops data.

### Email And Recruiter Tracking

The extension supports manually created recruiter threads and response tags. Recording a response clears Needs Response through that workflow. A live inbox ingestion/matching adapter was not established in this repository inspection. An assistant-connected mail tool is a separate capability, not proof the repository can poll or classify an inbox.

### Discord

The repository notifier plans from extension state and uses a local webhook variable. Dry-run is available; the npm notification script defaults to dry-run. Direct script execution can send if configured. There is no recurring scheduler in this path.

Known defect: fingerprints are stored before delivery acceptance, and HTTP status is not checked. Failed delivery can be treated as handled. This is not equivalent to a verified interactive bot integration.

### Networking And Analytics

Contact imports, shortlist ranking, research notes, and manual-send message drafts use the local store. Networking does not send LinkedIn messages. Analytics operates on records supplied to its implemented readers; snapshots and small-sample scaffolds do not prove trustworthy real-world conclusions or automatic learning.

> **Comments - Section 15**
>The browser will be reworked at a later point bcause much needs to change. 
> Add your comments here.

## 16. A Concrete Current User Journey

1. Tell the agent about yourself or provide a resume, then verify it actually saved the appropriate profile/CV/evidence files.
2. Review structured application answers and environment overrides; check the profile doctor.
3. Configure sources and scan, use agent discovery, or supply a job URL/JD directly.
4. Evaluate through Career-Ops or the separate evaluator wrapper; inspect report accuracy and resume output.
5. Sync artifacts into Maxim, then prepare and inspect the application queue.
6. Inspect one real application form; review what the mapper recognizes before filling.
7. Run guided assistance with an explicitly reviewed attachment and actual personal answers.
8. Complete unknown fields and review the application manually; current session handoff has the limitations above.
9. Submit yourself only when satisfied, then record the outcome and reconcile native/extension tracking.
10. Refresh dashboard state and run any desired notification command explicitly.

This is a sequence of agent actions, files, and commands. It is not yet a single reliably integrated conversational application service.

> **Comments - Section 16**
>I want to address this jounry when you ask me questions about this when I mke the final readme for the project.
> Add your comments here.

## 17. Evidence And Validation Boundaries

This document is based on inspected source and the preceding targeted November 16 test run, not a new full live-system test.

That run reported 61 passing and 3 failing tests out of 64. All eight browser integration fixtures passed. Failures concerned fallback-resume approval, source-audit help, and notification failed-delivery retry. The notification regression was reproduced after moving its temporary test path around a sandbox issue.

Fixtures validate selected mechanics in controlled pages. They do not validate every ATS, real credentials/login, durable review handoff, actual final submission, current live postings, or the separate web dashboard.

No real candidate values were exposed and no live external side effects were performed for this document.

> **Comments - Section 17**
>
> Add your comments here.

## 18. Review Questions Before Revising The Roadmap

These are questions for your comments, not implementation decisions:

1. How should users initially provide and verify their background: conversation, files, onboarding UI, or a combination?
2. Which source should own each fact, and how should conflicts between profile, CV, environment, and saved answers appear?
3. Which answers may be remembered globally versus per employer/job, and how does the user approve or revoke them?
4. Should application help always preserve a visible browser session, and how should the user ask it to resume?
5. What should happen when a field is ambiguous, a widget is unsupported, or login is required?
6. Which concrete forms define supported application coverage?
7. Which tracker owns submitted state, and how should other views reconcile it?
8. How should the web interface show live versus mock data and stale/missing synchronization?
9. Which email and notification capabilities are required, and which external connections are genuinely part of the repository?
10. What should count as a completed demo workflow without submitting an unwanted real application?

> **Comments - Section 18**
>1) Through an onboarding UI that allows users to drag and drop files. I think there should be an overlap between how E:\10x\10x-vantage\ handles agent conversations and this. I need to think about htis futher.  
>2) There should be a database table for all central factos for a person. I think these conflicts are a result of a disorganized respository. 
>3) For now, you can reasoably assume what type of common questions job applications ask globally. That said, the other nonstandards answers should all be saved for global use in their own table with relevant tags. If an answer isn't a standard answer, then the agent can search to see if its seen it before or a similar question by past questions asked for that company then all companies. The idea is that if a question that is unknown appears, then the user enters this information so the system can finish applying and remember for the future.
>4) My opion isn't fully formed since I plan on revaluating this in higher detail once I decide how the true user experience should work. There should be modes that show the brower and don't for remote use. 
>5) This is too ambigous of a question and will change based on the redesign. I plan on adding in memory for the agents so they can make an account or log in with existing credentials.
>6) I don't know but that will be solved later by design.
>7) There should only be one tracker. 
>8) There shouldn't be any mock data for now. This only makes sense during testing in a development mode.
>9) Gmail, discord, and tbd
>10) Acceptance criteria will be defined during the roadmapping period for each stage

## 19. Source Index

- [Agent onboarding and safety instructions](../AGENTS.md)
- [Data contract](../DATA_CONTRACT.md)
- [Profile example](../config/profile.example.yml)
- [Environment variable example](../.env.example)
- [Career-Ops router](../.agents/skills/career-ops/SKILL.md)
- [Native application instructions](../modes/apply.md)
- [Native scan instructions](../modes/scan.md)
- [Scanner](../scan.mjs)
- [Gemini evaluator](../gemini-eval.mjs)
- [Evaluation wrapper](../maxim/scripts/evaluate-job.mjs)
- [Profile loader and application planner](../maxim/lib/auto-apply-planner.mjs)
- [Field classification and mapping](../maxim/lib/application-form-mapper.mjs)
- [Browser extraction/navigation/filling/reporting](../maxim/scripts/auto-apply-browser.mjs)
- [Application queue/lifecycle logic](../maxim/lib/application-tracker.mjs)
- [Application mutation CLI](../maxim/scripts/application-tracker.mjs)
- [Artifact sync](../maxim/lib/tracker-sync.mjs)
- [SQLite store](../maxim/lib/sqlite-store.mjs)
- [Database schema](../maxim/db/schema.sql)
- [Append-only event writer](../maxim/lib/event-log.mjs)
- [Dashboard snapshot generator](../maxim/lib/dashboard-snapshot.mjs)
- [Go dashboard service](../dashboard/internal/maxim/service/service.go)
- [Discord notifier](../maxim/scripts/discord-notify.mjs)
- [Historical implementation log: not current proof](../docs/maxim/implementation_status.md)

> **Comments - Section 19**
>
> Add your comments here.

## 20. Miscellaneous Ideas And Additional Requests

Use this section for features, improvements, questions, or changes you want to add anywhere in the system. These are ideas for review, not approved implementation scope.

> **Additional Ideas**
>
> - Idea or request:
> - Where it might belong (optional):
> - Why it matters / desired behavior:
> - Additional notes:  
>
1)  The whole codebase needs refactored and organized. THere is a lot of slop and unfininished code that needs removed. 
2) Broswer interaction needs to be overhauled. Existing non career ops code should be removed  
3) My user data should never be in gitlab. 

>
> **Comments - Section 20**
>
> Add your comments here.

