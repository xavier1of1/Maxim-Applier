# Maxim Apply Implementation Status

Updated: 2026-11-19. Canonical repository: `D:\VSC Programs\maxim-apply`.
Model integration update: 2026-11-20. Dynamic account-visible model selection and
manual exact-ID entry replace the name whitelist. One shared Responses transport
serves chat, retained scoring, source interpretation and interview feedback;
existing runtime configs default to their original Chat Completions transport.
Task support is not inferred from a model listing. See the current
[model verification](../../roadmap/reviews/openai-model-compatibility.md).
This change passed 130 isolated integration, 29 Chromium and 46 app unit tests,
plus the retained/native, Rust, Go, build, safety, privacy and roadmap checks.
S0-S5 are verified for their bounded scopes and are recorded as separate stage
commits. S6-S10 implementation and S11 acceptance infrastructure are integrated
and passed the November 19 combined regression. They remain In progress where
live or owner-approved gates are open. No production personal-data migration,
disclosure or account enablement was automatic.
The prior June implementation record is retained in
[the historical archive](archive/pre-s5/implementation_status.md), not current guidance.

## Available Workflow

### Job Fit Visibility (2026-11-20)

Jobs and Discovery expose the latest stored Career-Ops score/tier. Jobs defaults
to highest score first, with low-first, recent and company sorts retained in the
URL; its details show the report, evaluation date and candidate revision, and can
explicitly queue evaluation without inventing fit from a scan. Unknown, queued,
failed and stale states remain distinct. Only current evidence ranks numerically.
Database sorting precedes the snapshot cap; an older selected record remains
accessible even outside the 500-row window. No bulk model requests were run.

Verification: 48 app unit tests, 46 relevant integration cases and 13 Chromium
tests passed (Jobs, Discovery, packets, workspace and new score workflow). After
visual inspection, a mobile action-row wrap adjustment passed a fresh production
build/typecheck and both desktop/mobile score cases again. Safety, privacy,
roadmap validation and diff checks pass. No core Career-Ops scorer/scanner was
changed. See [scanning and score semantics](job-scoring.md).

Current use/setup: [Start and use Maxim](setup.md). The November 18 storage follow-up
recovered Docker, fixed fixture/volume cleanup, relocated required browser binaries,
cleared separately approved unused build cache and verified fresh backup/restore.
The running workspace includes the November 19 journey fixes. Discovery has
94 verified NoVA/DC locations across six employers; these are not fit scores.
Personal candidate authority, evaluation model access and selected integration
accounts still require owner review/setup. See
[storage results and safe commands](storage-maintenance.md) and
[measured verification and exact next steps](../../roadmap/reviews/mvp-completion-verification.md).
The [journey audit](../../roadmap/reviews/2026-11-19_DRIFT_REPORT.md) lists
verified bugs, repair order, live search evidence and open acceptance decisions.

- Local Next/React/Astryx dashboard, authenticated API, PostgreSQL and durable worker.
- Reviewed PDF/DOCX/Markdown/text candidate intake, per-fact correction/disclosure,
  source erasure/retention and explicit candidate ownership cutover.
- Scoped reusable answers, exact approval, correction, revocation and reuse review.
- Bounded public Greenhouse/Lever/Ashby discovery, saved/dismissed jobs, history,
  source health, checkpoints, pacing and explicit coverage limitations.
- Retained Career-Ops evaluation with immutable invocation context, Rust report/
  score validation, Maxim tiers/policy and explicit T1 strategic overrides.
- Evidence-only native PDF packets with exact report/PDF approval and stale guards.
- Distinct preparation/start/review/fill/manual submission/outcomes and immutable
  action-time history, including external manual submissions and duplicate warnings.
- Owner-reviewed lossless legacy import, paginated reconciliation, controlled
  application cutover, hash-checked native/Go reads, recovery and latest-state rollback.
- Shared agent evaluation/read tools and canonical CLI commands.
- Native agent-browser application preparation, exact approved facts/answer reuse/
  PDF, durable local progress, pause/resume and explicit manual handoff.
- Opt-in read-only Gmail selected-thread evidence, corrections and response tasks.
- Opt-in existing Discord destination, previews, accepted/uncertain durable
  delivery, bounded retries and calendar schedules.
- Reviewed raw contact/history import, researched manual networking drafts,
  recruiter corrections and sample-aware outcome analytics.
- Role-linked private interview practice, whole approved evidence and separately
  consented optional model feedback, never promoted to candidate truth.

## Start And Use

~~~powershell
cd "D:\VSC Programs\maxim-apply"
npm run maxim:workspace
npm run maxim:workspace:key
~~~

Open the printed URL, normally http://127.0.0.1:3010/maxim.
Do not paste the sign-in key into chat. Configure model access in Settings;
review Candidate knowledge before evaluating. Create/save a role and intent,
then use Applications to evaluate, prepare/review a packet and track manual progress.
Startup never imports personal sources or switches ownership automatically.

[Workspace](workspace.md) | [Candidate](reviewed-onboarding.md) |
[Answers](answer-memory.md) | [Discovery](discovery.md) |
[Applications and cutover](application-lifecycle.md).

## Tests

~~~powershell
npm run maxim:workspace:test
npm run maxim:test
npm run maxim:safety
node roadmap/validate-roadmap.mjs
node --test roadmap/validate-roadmap.test.mjs
cd dashboard
go test ./...
~~~

Use the pinned app Node 24 and Rust 1.76+/MSVC. Integration/Chromium tests create
separate disposable PostgreSQL containers/private fixtures; no production fallback
is permitted. Native `test-all.mjs` is mutation-capable and must run only in an
isolated sanitized checkout, not the personal tracker.

Final S5 results: 29 Rust, 15 unit, 72 integration TAP cases (including parent
cases), 15 Chromium workflows, typecheck and production build pass. The final
completed-application UI polish also passed all three targeted S5 browser flows.
Retained Maxim: 57 passed. Native sanitized suite: 146 passed, zero failed,
one expected missing-CV warning. Go, safety, privacy and roadmap checks pass.
Use `npm run maxim:native:test` for the safe native full-suite wrapper and
`npm run maxim:privacy` for the separate public-tree privacy audit.

Post-S5 discovery reliability follow-up (2026-11-17): long public descriptions
could exhaust the five-second Rust adapter deadline because clearance patterns
were compiled for every sentence. They now compile once per posting with
unchanged policy semantics, input limits and network bounds. A synthetic
43,233-character case reproduced the timeout before the fix. The real adapter
regression covers a required clearance at the end, a non-required clearance,
and oversized-input rejection. All 29 Rust and 17 app unit tests pass.
Live discovery still reports oversized feeds and bounded-page coverage explicitly;
source failures are not treated as empty successful searches or fit evaluations.

## Current Verification And Manual Gates

Current checks: 40 app unit, 29 Rust, 70 retained Maxim and 146 sanitized
native checks pass; Go, safety, privacy, typecheck/build pass. The native suite has
one expected missing-CV warning and Windows shell-path warnings in its legacy
privacy probes, covered separately by the Maxim public-tree privacy check.
The complete November 19 isolated integration suite passed 129 cases (including
parent cases and both S11 rehearsals), and all 27 Chromium UI tests passed.
See the verification record for tested boundaries and dated live public-feed
evidence. No live mail, webhook, model or
employer application action ran. Keep the remaining stages In progress; fixture
tests do not grant live permissions or sign off a demonstration profile.

Remaining: certify permitted live form variants, approve the proposed demo profile,
then review separate personal authority/model/
Gmail/Discord configuration. [Setup](setup.md) supplies the exact workflows;
[verification](../../roadmap/reviews/mvp-completion-verification.md) lists commands
and source boundaries. This is not a claim of full MVP acceptance.

## Deliberate Limits And Setup

- S6-S10 are implemented extensions, not live setup or universal site certification.
  S11 final acceptance remains incomplete until the blocked tests and manual gates pass.
- No final application submission, LinkedIn sending, evasion or fabricated claims.
- The rejected planner/mapper/runner is retired, not an alternate executor.
- Existing network/recruiter/history bytes remain private; unadapted canonical
  consumers fail explicitly instead of reading stale SQLite applications.
- No production data cutover, source approval or live model quality claim is implied
  by fixture acceptance. Each is an explicit user operation.
- Required: Docker Desktop, local dependencies/Rust toolchain, authorized candidate
  sources and reviewed facts. Model features need a compatible OpenAI model/key.
  Public feed search needs company board slugs, not LinkedIn credentials.
- Gmail/Discord/wearables need separate authorization and their stage acceptance;
  an assistant-connected account does not configure the product.

See [operational inputs](../../roadmap/operational-setup.md) for accounts/permissions,
[S2-S5 execution](s2-s5-execution.md) for commit history, and the stage evidence
records for exact measured results.

Assumptions: preserve retained scoring/generators; use narrow TypeScript orchestration
with isolated Rust pure logic; manual declarations record real external actions,
not automation; explicit ownership gates supersede old file-write instructions.
