# Discovery Intelligence

Implemented on 2026-11-20. This is an extension of the existing workspace and
Career-Ops engine, not a replacement scoring system or second CRM.

## Setup

1. Start the [workspace](setup.md); Home is the default page.
2. Review Candidate facts, including actual skills and target roles. Explicitly
   approve professional-source model disclosure and canonical candidate authority.
3. Connect a model in Settings and confirm access. A model listing alone does not
   prove it can complete Career-Ops evaluations.
4. Add public company boards in Discovery. Automatic coverage remains Greenhouse,
   Lever and Ashby, not LinkedIn/Indeed/Workday or the whole internet.
5. Open Settings > Discovery intelligence. Choose an enabled board rotation pool and
   target title terms (empty terms fall back to approved role preferences). One to
   three sources are selected per scan, rotating across the pool rather than
   permanently restricting scheduled discovery to the first three employers.
6. Review capacity, intervals, age/evidence limits and daily request/token budget.
   Input/output USD prices per million tokens must match the exact model ID.
   Automatic spending starts at zero; enter a deliberately small allowance large
   enough for one displayed conservative reservation if enabling automatic scoring.
7. Turn on only desired automation and confirm the exact permissions. Saving a
   policy enforces lead capacity; it does not itself prune current records.
8. Inspect Scoring preview and Recent cycles. Run enabled cycle is optional;
   the worker also checks persisted due times once per minute while running.
9. Preview cleanup before its first use. Daily cleanup is separately opt-in.

No new bot, external discovery key or account is required for these public feeds.
An evaluation API key is required only for model tasks. Settings prices are a
local allowance estimate; check your provider's billing dashboard separately.

## Current Defaults

| Setting | Default | Bound |
| --- | --- | --- |
| Scheduled scans / paid scoring / cleanup | Off | Independent owner consent |
| Active leads | 200 | 20-2000 |
| Scan interval | 360 minutes | 30-10080 |
| Scoring interval | 60 minutes | 15-10080 |
| Sources / processed matches | 3 / 100 | Up to 3 / 500 |
| Evaluations per cycle / local day | 5 / 10 | 1-20 / 1-100 |
| Posted age | 7 days | 1-90; unknown held by default |
| Approved skill evidence matches | 1 | 1-10 |
| Automatic monetary allowance | 0 USD cents | 0-10000 cents/day |
| Automatic token allowance | 1,000,000 | 1,000-20,000,000/day |
| Posting/idle leads / raw cache retention | 30 / 7 days | 1-365 / 1-90 |
| Timezone | America/New_York | Valid IANA zone |

The source pool supports up to 200 boards; one to three are selected per run.
Per-source allocated-record cursors and fetched-page rotation prevent a tiny
match cap from permanently restricting a source to the same feed/page prefix.
The existing six-request/three-page-per-source/5 MiB response/90-second scan
boundaries and host pacing remain. A vendor can return a larger feed than the
processed-match limit. Scheduled checkpoints retain at most 500 KiB per page;
intake is fairly divided among sources and rotated before limiting. Bounded
intake and capacity holds produce partial coverage, not a false complete result.

## Selection And Timing

The worker coalesces due schedules rather than replaying missed intervals. A
completed scan makes scoring due. No resident LLM or recursive agent is involved.
Rust examines at most 200 byte-bounded posting summaries per rotating, wrapped
window (up to 2,000 active leads by configuration), and only approved current,
model-permitted `skills.*` values. It holds policy-blocked/unreviewed locations,
incomplete descriptions, unknown/old dates, excluded titles and insufficient
evidence overlap. The local excerpt is a cheap prefilter and can miss evidence
outside it; explicit full evaluation remains available. Existing current/pending/
failed evaluations are not blindly
charged again. Explicit manual evaluation remains available for review/retry.

Eligible leads are ordered by verified overlay, target title and freshness, with
employer round-robin selection and every fifth automatic slot eligible for
exploration beyond target titles. Exploration carries across smaller batches.
This is categorical queue prioritization, never a second fit score or a claim
that keyword overlap establishes competitiveness. Career-Ops supplies that result.

Automatic work snapshots the settings revision, model/API and candidate/posting
versions. The existing evaluation queue still performs disclosure, evidence,
prompt-integrity, posting and ownership checks. Source/setting changes revoke
queued grants; changed candidate evidence prevents stale publication.

Posting-specific validation failures become revision-bound automatic holds and
do not abort safe later selections. Candidate/posting changes invalidate those
holds. Global configuration/authority/budget failures stop the batch instead.
Partial settings changes preserve omitted fields; creation defaults are not
reapplied. Chat reads a bounded summary with explicit omission markers rather
than an implicitly complete truncated source pool.

## Budget And Recovery

Reservations serialize under a workspace transaction lock. Input allowance is
196,608 bytes plus 4,096 framing-token reserve; output allowance is 8,192 tokens.
Token, request and owner-priced monetary bounds all gate admission. The monetary
reservation rounds up to cents. Actual normalized token usage settles the local
estimate. Missing/ambiguous post-dispatch usage keeps the full reservation.

Only one automatic evaluation can hold a work lease per workspace, enforced by a
database partial unique index. Automatic work has one attempt. A durable sending
transition prevents automatic retransmission after a crash; maintenance marks
interrupted sends uncertain and undispatched cancelled reservations released.
Queued reservations cannot cross their policy-local day into a fresh allowance.
Local model/context compilation precedes sending. Day and lease checks use actual
wall-clock time after locks, not a transaction-start timestamp held across midnight.

Pause stops future automated dispatch and fences publication, not an HTTP request
already dispatched. That request may still disclose the approved context and be
charged. Uncertain costs remain reserved for their original local day. The model
cannot release them or silently retry them. Inspect the provider's ledger and use
an explicit manual evaluation only when a second paid attempt is intended.

Manual evaluations, chat, extraction interpretation and interview feedback are
outside the **automatic evaluation** allowance. No project-wide billing guarantee
is implied. A model/pricing mismatch holds automated work until owner review.

## Hold Recovery

| Hold | User action |
| --- | --- |
| Candidate authority / evidence | Review Candidate and model disclosure; approve actual skill facts |
| Model / pricing / allowance | Review Settings connection, exact pricing model and deliberate limits |
| Full posting required | Open Jobs; fetch exact supported Greenhouse details, or use supported manual posting correction |
| Unknown posted date | Review the source; explicitly allow unknown dates only if desired |
| Location / hard blocker | Inspect posting policy; never bypass clearance or fabricate eligibility |
| Failed / uncertain evaluation | Inspect failure/provider usage; explicitly retry only if a new paid attempt is intended |
| Capacity | Save important leads; preview cleanup or raise capacity within bounds |
| Source cooldown / changed source | Respect cooldown; start a fresh reviewed query |

## Retention Contract

Cleanup is preview-bound and rechecked in the same application/intelligence lock
order as saved state, notes, application creation, uploads, scan publication and
evaluation work. A protection change invalidates the fingerprint. Active scan,
evaluation, packet or browser work holds compaction entirely.

Saved jobs, user notes, reference files and every application/packet are protected.
Submitted or terminal application records remain evidence-protected but do not
consume active-lead slots. At capacity, approved cleanup targets 10% headroom,
preferring unscored/lower-fit unprotected leads; it does not evict current T2+ for
headroom alone. Idle/dismissed unprotected leads are also eligible. Protected
overage is displayed and ingestion held, never solved by deleting evidence.
Known posting age also expires at the configured lead-retention window, with a
24-hour grace after posting/restoration updates; repeated feed observations alone
do not keep an old unprotected posting forever. Unknown/responded outcomes without
a submission date still consume protected active slots; an outcome tag alone does
not prove submission.

A batch compacts up to 50 jobs and 20 expired terminal scan runs. The separate
`job_archive` keeps title/company, posted/first/last-seen timestamps, location,
source/URL, up to 4,000 characters of exact source qualification text, score/tier,
current-at-archive status, candidate revision, industry/lane and archive reason.
Missing source qualifications remain missing, not generated by an AI.

Compaction strips the job description, duplicated evaluation prompt/facts/posting
snapshots and explanation, unreferenced evaluation reports, and raw observation
fields. Old terminal provider-page caches are emptied and retry fenced after the
configured raw-retention interval; submitted evidence has its own immutable
snapshot/report/PDF. Native tracker/projection files, candidate knowledge,
conversations and protected references are not silently deleted by job cleanup.
Live leads retain compact compensation/secondary-location policy fields used by
the retained eligibility engine, so raw-cache expiry cannot change their policy.

Stable opening stubs prevent ordinary rescans from repopulating archived payloads.
Archive search uses 50-row pages. Restore preserves identity and requires capacity;
it restores neither the removed posting description nor approval of the historical
score. Fetch fresh details and re-evaluate before application use. Compact history
is retained indefinitely by default. Backup expiry and physical Docker disk
compaction remain [separate managed operations](storage-maintenance.md).
Restored roles awaiting details are excluded from automatic recompaction. If
deliberately rearchived before refresh, their known qualification snapshot remains.

## Filters And Home Formulas

Job predicates and score ordering are applied in PostgreSQL **before** the 50-row
UI page. Current score means candidate/posting/engine/policy/dependency revisions
match the retained evaluation. A selected record can remain inspectable outside
the filtered list. Filters/page position persist in the URL, not local storage.
Industry is Unknown until confirmed as source metadata in Settings; it is not
guessed from a company name. Role types are deterministic title classifications,
not fit scores or candidate claims.

Home contains exactly eight metrics:

1. Applied today: known opening identities deduplicated since local midnight.
2. Applied this week: since Monday local midnight.
3. Scanned: distinct observed job identities in the last rolling seven days.
4. Fresh high-fit: current T2+ unsubmitted/nonarchived jobs inside posting age and
   seen within 48 hours, with compatible location and no hard blocker.
5. Awaiting response: the latest submitted outcome per known opening identity.
6. Interview evidence: distinct submitted cohort records with current or recorded
   interview evidence after the latest submission/correction.
7. Offer evidence: equivalent offer derivation.
8. Automatic cost: today's settled estimates plus outstanding reservations.

Sankey cohorts are rolling 30/90/365-day recorded submissions, excluding future
dates and corrected not-submitted outcomes. Known canonical posting URLs/IDs are
deduplicated; unknown identities remain separate. The latest submission's outcome
wins and recorded cohort stage evidence is combined. Within each record the
latest correction/re-submission resets earlier stages. Missing stages are not
invented. Pending, active interview/offer, rejection, withdrawn and unknown are
explicit terminals, not counts of every historical application attempt.

Up to five role lanes use the fresh high-fit definition, ordered by best retained
score and available opening count. Fewer valid lanes produce fewer recommendations.
Current fit does not prove a vacancy remains open: liveness remains unconfirmed.

## Files And Verification

Primary modules: `intelligence-policy.ts`, `intelligence-cycle.ts`,
`intelligence-budget.ts`, `intelligence-retention.ts`, `job-filters.ts`, `home.ts`
under `maxim/app/src/server/`; pure rules live in `maxim/runtime/src/intelligence.rs`.
Existing native scoring/provider/browser implementations remain the engine.

Run `npm run maxim:workspace:test` for the isolated suite. See
[roadmap](../../roadmap/discovery-intelligence/README.md),
[review findings](../../roadmap/discovery-intelligence/reviews/2026-11-20_DRIFT_REPORT.md)
and [implementation status](implementation_status.md) for measured evidence.
No fixture, installed dependency or health check proves owner-enabled live billing,
public-board coverage, Gmail/Discord access or successful employer submission.
