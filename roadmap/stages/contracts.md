# Shared Stage Contracts

**Status:** Revision 0.6. S1 workspace/auth/commands/conversations/artifacts, S2 worker/candidate and S3 answer/context contracts are verified. Tracker and later integration contracts remain proposed. See [S1 evidence](../reviews/s1-workspace.md), [S2 evidence](../reviews/s2-onboarding.md), [S3 evidence](../reviews/s3-answer-memory.md) and [ADR 0006](../../docs/maxim/decisions/0006-workspace-implementation.md).
**Updated:** 2026-11-16.
**Purpose:** Keep the detailed stages consistent without repeating a full architecture in each file. A changed contract must update its producer, consumers, tests, and the stage registry together.

## 1. Proposed Implementation Binding

The accepted direction is PostgreSQL/private artifacts/Compose and an early dashboard/agent. The following is the recommended concrete binding for S0 to test and record in a decision, not a silent installation:

| Boundary | Proposed default | Reason and gate |
| --- | --- | --- |
| Web/API | One Next.js React 19/TypeScript workspace under `maxim/app/` | One Node application; reuse actual located frontend only if it satisfies the same contracts |
| Domain services | `maxim/app/src/server/`, with pure ports around existing MJS helpers | UI, agent and CLI adapters call one service; not a second evaluator |
| Database | PostgreSQL SQL migrations in `maxim/db/postgres/`, driver behind repositories | Do not transplant Dossier's Prisma schema or SQLite SQL strings |
| Long-running work | Host Node worker in `maxim/app/src/worker/`, first consumed by S2 extraction | Reuse durable claim/lease/event mechanics in later stages |
| Windows composition | PostgreSQL in local Compose; web and worker run on the interactive Windows host initially | Visible Chromium and native tools need no container-to-desktop bridge |
| Browser | Worker invokes a reviewed executor on the same interactive host | S6 confirms permissions/session/daemon behavior; no exposed CDP endpoint |
| UI components | Astryx candidate, one design-system foundation | Compatibility/accessibility spike; no Dossier AGPL component transplant by default |
| Models | One server-side adapter; exact provider/model remains a recorded deployment decision | No provider-specific memory authority; supported counter/budget required |

If S0 selects a different framework or reuses an existing app, update this binding and all proposed paths before coding. Do not quietly run web in Linux containers while assuming `127.0.0.1` reaches a Windows headed browser or host DB. Remote/cloud operation is separate scope.

Pin supported runtime/package/browser/DB versions after checking actual requirements. Observed host Node is v20.15.1 and Go is go1.26.4; these observations do not certify proposed dependency compatibility.

> **Comments**
>
> Add corrections or additional requirements here.

## 2. Command, Confirmation, And Read Contract

Every mutation has an authenticated actor/workspace, command identity, expected entity revision, validated payload and reason/evidence where relevant. The server supplies actor identity; a model cannot choose another actor in tool arguments.

Persist a command payload hash with its idempotency key. Repeating the same command returns the same outcome; reusing a key with different payload or a stale revision is rejected. Validate scope and fact/attachment revisions again at confirmation/execution, not only when a proposal was drafted.

A model proposes consequential changes. A human-approved proposal names the exact action, target, values and relevant revisions; the model cannot confirm its own proposal. Ordinary UI forms reach the same command implementation. Unauthenticated requests, cross-workspace IDs and expired confirmation tokens cannot write.

Reads carry record IDs/revisions, source references, observation time, source status and warnings. Use an explicit vocabulary such as fresh, stale, partial, empty, unavailable and unsupported; no automatic sample-data fallback. Avoid revealing unauthorized object existence.

Local-first is not no-auth: loopback binding, origin/CSRF protections, an explicit local session/bootstrap mechanism, protected server secrets and candidate scoping are S1 obligations. Two isolated fixture identities prove the boundary without building a multi-tenant SaaS.

> **Comments**
>
> Add corrections or additional requirements here.

## 3. Identity And Ownership

| Entity | Required identity and ownership rule |
| --- | --- |
| Candidate/workspace | One active candidate authority per entity; actor scope is separate from a model conversation |
| Job opening | Stable internal ID plus unique source/provider/job-ID aliases; company/title similarity is a warning, never sufficient identity |
| Application | Links candidate and opening; explicit reviewed reapplication can create a new attempt; repeating intake does not |
| Evaluation | Versioned result tied to job/JD and candidate/context revision, provider/model and retained Career-Ops semantics |
| Source/artifact | Opaque ID, content hash, private location and revision; a path/filename alone is not approval |
| Contact/thread/message | Source IDs/aliases plus candidate scope; identity does not depend solely on a display name |
| Legacy import | Source-scoped legacy key -> canonical ID mapping, raw payload and import batch; moving a source file must not create a new candidate |

Track ownership state per entity family: legacy active -> staging import -> reconciliation approved -> canonical active. Never present staging as production truth. Cutover changes the supported write routes and reader contract in one controlled release; do not rely on permanent two-way sync.

Candidate cutover is S2, application/tracker cutover S5, and contact/history feature adaptation S9. S1 starts an explicitly isolated new/fixture workspace and does not import all legacy data automatically.

> **Comments**
>
> Add corrections or additional requirements here.

## 4. Candidate Facts, Answers, And Artifacts

Source bytes, extracted proposals, confirmed facts, reusable answers, and conversation summaries remain distinct. Fact and answer revisions record source/evidence, approval, sensitivity, allowed reuse context, status and supersession/revocation.

Use standard typed lookups first. For novel answers, search the same candidate's current-company history before compatible cross-company history. A stored but unapproved answer is searchable history, not automatic-fill permission.

Current candidate claims must be supported by candidate evidence, not words in a job description. A correction invalidates dependent drafts/packets for future reuse; already submitted immutable artifacts remain historical. Retention/deletion must include private logs, mail, practice artifacts, and backup expiry.

Artifact metadata includes candidate/workspace, kind, hash, source/evaluation/resume revisions, approval and private storage reference. Authorize download/render and avoid returning raw host paths in web/API/model results. Secrets/browser profiles are not ordinary downloadable artifacts.

File intake validates content/size and rejects active/unsupported content, archive traversal, decompression abuse and encrypted/unreadable files. Scanned PDFs can require manual text; OCR is not assumed. Model interpretation is consented/minimized and never receives prohibited proprietary content.

Raw uploads and exact raw historical fields are preserved under an explicit retention policy; normalized data is separate.

> **Comments**
>
> Add corrections or additional requirements here.

## 5. Lifecycle And Fit

Preserve Career-Ops scoring: T0 below 3.5; T1 3.5 to below 4.0; T2 4.0 to below 4.5; T3 4.5 through 5.0. Reject invalid/absent scores rather than coercing them to T0. Priority/connection/top-20-percent overlays do not replace that score.

Keep workflow readiness separate from outcome:
- Workflow: intent, packet_missing, packet_ready, assist_running, needs_input, review_ready, paused or failed.
- Outcome: not_submitted, submitted, responded, interviewing, offer, rejected, withdrawn or unknown.
- Evidence: user declaration or attributable observation with source/time; an email hint or a filled page is not a submitted outcome.

These are proposed normalized values. S5 must map native statuses and preserve originals without silently treating Evaluated as Applied.

An approved packet binds report/PDF/answer revisions and content hashes. Only user confirmation or accepted attributable receipt evidence records submission; the application retains score/tier/policy and artifact snapshots at action time. Manual legitimate submissions outside the assistant can be recorded without requiring an already prepared packet.

Duplicate detection uses source IDs/URLs and known attempt history. Distinct employer job IDs/materially distinct openings can proceed with warning; fuzzy company/title matching cannot merge them silently.

> **Comments**
>
> Add corrections or additional requirements here.

## 6. Transactions, Workers, And External Effects

S1 commits canonical mutations, idempotency result and domain event in one PostgreSQL transaction. JSONL exports are derived, not a second commit authority. Current SQLite Python calls and JSONL appends do not already provide this guarantee.

S2 introduces an actually consumed durable work queue for extraction: queued, leased, completed, failed or cancelled; lease owner/expiry/attempt/retry time; command/input revisions and actor scope. Renew/complete with compare-and-swap. A lost lease cannot publish, two workers cannot both finalize, and cancellation is checked before external work and publication.

Later features reuse the same worker mechanism. Database work/outbox enqueue commits with the initiating state change. External HTTP/browser effects cannot be atomic with DB commit: distinguish attempted, accepted, failed and unknown outcome. Reconcile uncertainty; never blindly replay a potentially consequential browser action.

Use bounded retries for transient failures with provider retry hints; authorization, policy denial, malformed input or uncertain final action do not trigger blind retries. Persist schedule/timezone/next-run state rather than relying solely on process timers.

No exactly-once remote delivery claim. A request accepted remotely but followed by a local crash can duplicate on retry; use stable delivery IDs and a documented uncertainty policy.

> **Comments**
>
> Add corrections or additional requirements here.

## 7. Discovery, Fetching, And Policy

A source definition is not coverage proof. Record attempted/successful time, selected method/provider, query/filter/version, pagination/completeness, posted time, first seen, quota/error and manual fallback owner. Distinguish successful empty from unsupported, partial, stale, blocked and failed.

User/job/provider URLs are untrusted network input. Use allowed schemes, destination/redirect validation, time/response limits, and protections against private/link-local/metadata destinations and DNS/redirect changes. Approved local fixture servers are a test-only exception, never a broad production SSRF exception.

Reuse retained scanner providers or an isolated artifact-producing adapter. The current scanner writes pipeline/history files and is not a side-effect-free importable search API; importing it into the web process must not start a scan or write legacy trackers.

Apply confirmed location/salary/clearance rules. Unknown location or salary remains unknown/reviewable; an aggregator broadening a location query cannot bypass local policy. Posting time is not first-seen time.

Xavier's confirmed starting policy must be represented as candidate-scoped configuration/evidence, not silently inherited by a different candidate:

| Policy | Required starting behavior |
| --- | --- |
| Geography | NoVA/DC; Maryland excluded unless explicitly overridden; Gainesville/Manassas included; compatible multi-location allowed. Normalize region/country and do not mistake a same-named non-Virginia city for NoVA. |
| Salary | Preserve $85k hard minimum, $90k T3 flat minimum, and approved range rule (min at least $80k, max at least $95k, $90k comfortably supported); existing approved above-target-range interpretation must not be changed incidentally. Unknown currency/units are reviewed. |
| Expected salary | Posted-range median with $100k default minimum; text: Negotiable based on role scope and total compensation; $110k only when high fit and range supports it; unclear cases reviewed. |
| Authorization/clearance | Xavier states U.S. citizen, no active clearance, willing/eligible to obtain. Never claim active clearance; another candidate's missing boolean remains unknown. |

S5 policy fixtures must cover boundary values and any ambiguous range interpretation explicitly; no new competing fit score or silent salary-policy change.

S5 can evaluate manual job intake without S4. Automated discovery claims and fresh alerts require S4 evidence; missing posting time does not qualify as known fresh.

> **Comments**
>
> Add corrections or additional requirements here.

## 8. Browser Authority And Honest Support

The executor receives a candidate/application session, allowed origins/actions, current packet and answer revisions, explicit limits and user-approved login authority. Page content cannot grant actions or expose a shell/SQL/script tool.

Dedicated protected profiles only; explicit user login/MFA/challenge handling. No default attachment to an ordinary personal browser, exposed debugging server, stealth/evasion/CAPTCHA service or hidden action.

A typed high-level action must bind to a freshly observed control in a supported adapter. Unknown navigation, cross-origin destination, final confirmation or ambiguous control stops for human handling. Label matching alone is not a final-action guard.

Final submission is never in the agent command surface. Test Enter, default buttons, multi-step final pages, form events, direct network actions and hostile page instructions. Fields can autosave or transmit to the employer before final submission; disclose that and obtain consent. Filling is not a no-network guarantee.

The supported-site matrix is per form/control/session variant, not a brand-wide promise. Pilot Greenhouse/Lever; later custom/company/Workday/LinkedIn/Indeed require explicit proofs and permission. Unsupported forms remain manual, not missing jobs.

Persist progress without storing raw cookies, passwords or unnecessary field text in ordinary events/traces. Stale/lost sessions are not proof an action failed remotely; re-observe and request user confirmation when uncertain.

> **Comments**
>
> Add corrections or additional requirements here.

## 9. Mail, Notifications, Networking, And Metrics

Gmail ingestion is read-only initially, provider-ID idempotent and consented. A mailbox grant may be broader than the messages Maxim processes. Match/correct applications and response tasks through canonical services; ambiguous or retracted evidence cannot silently mutate another record.

Reuse the existing maxim applier Discord destination. Application alerts use S5; mail-derived reminders require S7, networking/manual recruiter queues require S9, and automated freshness claims require S4. A name is not a secret/channel-ID discovery method. Record attempts separately from accepted delivery and suppress only according to acceptance/uncertainty policy. Redact content; no private attachment/mail body in an alert by default.

Contacts/research/drafts remain candidate-scoped. Preserve strength 1-3 and manual statuses; no LinkedIn/social publishing or message-send tool. Drafts require person research, role, supported background, fit rationale and CTA.

Interview-rate denominator is unique confirmed submitted NoVA/DC-compatible application attempts in the declared cohort, not all discovered/evaluated records. Numerator is those attempts with a reviewed/high-trust interview signal. Unknown location/outcome is reported separately, not inferred. Define as-of/cohort/maturity, 0/0 as unavailable rather than an achieved 0 percent, and small-sample warnings.

Feature projections must retain evidence correction: clearing Needs Response after a recorded reply must not revive it from an old ingestion retry.

> **Comments**
>
> Add corrections or additional requirements here.

## 10. Verification Contract And Proposed Paths

Existing baseline tests remain separate from future acceptance. New product tests are planned under `maxim/app/tests/` so the current legacy recursive test runner does not accidentally start a database/browser suite.

S1 must create the real isolated HTTP/model/DB harness and compile/start path. Proposed later commands such as `node --test maxim/app/tests/integration/onboarding.test.mjs` are **not runnable today**. The named test file and harness must be implemented before using the command as evidence.

The harness uses dedicated disposable PostgreSQL credentials/storage, explicit synthetic artifacts, ephemeral ports and a scripted loopback model/provider. It refuses production DB/private-data paths before setup or cleanup. UI E2E uses a declared local Playwright test dependency; fixture success is not live platform certification.

| Verification layer | Purpose |
| --- | --- |
| Pure unit | Tier/policy/parser/ranking/retrieval/lifecycle logic |
| Service/DB | Real migrations, scoped HTTP/tool commands, transaction/lease races, restart and restore |
| UI/agent | Same IDs/revisions, confirmation, failure/empty states, keyboard/mobile behavior |
| Browser/provider fixtures | Bounded actions, denied effects, stale/unknown state, malformed responses |
| Consented live smoke | Selected real provider/site/integration only, no automatic final application action |
| Migration | Raw fields, IDs, artifacts, writer gating, checksums, rollback |
| Roadmap validation | Document links/structure, stage graph, handoff coverage, acceptance/test IDs |

Planning validation does not execute future product acceptance. No checkbox is checked merely because its case is named. Vantage supplies the format, not its Rust stack, APIs, identity model or Shipped labels.

> **Comments**
>
> Add corrections or additional requirements here.

## 11. Miscellaneous Contract Questions

Record changed assumptions here, then update the producing stage, consuming stages and registry. Do not implement a local workaround that creates a second source of truth.

> **Comments**
>
> Add corrections or additional requirements here.
