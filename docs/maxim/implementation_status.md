# Maxim Apply Implementation Status

Implementation baseline last updated: 2026-06-10
Planning/development handoff updated: 2026-11-16

## November 2026 Planning Handoff

### Latest Refinement And Detailed Stages

- [Twelve detailed stage plans](../../roadmap/stages/README.md) now define 92 acceptance cases, implementation slices, actual versus proposed test paths, files, handoffs, cutovers, rollback and deferrals in the inspected Vantage style. All implementation stages remain Pending.
- [Shared contracts](../../roadmap/stages/contracts.md) bind identity/auth, PostgreSQL/private artifacts, Windows host/browser composition, durable work, retained Career-Ops semantics and manual final action. Manual job evaluation no longer depends on automated discovery; S2 introduces the consumed worker.
- [Drift/refinement evidence](../../roadmap/reviews/roadmap-refinement.md) records actual code gaps and executed checks. Fresh unit result is 53/55 pass; fallback attachment approval and source-audit help fail. Isolated Discord retry also fails. Dashboard Go tests and static safety check pass.
- Read-only roadmap validation passes for 22 documents, 211 local links/anchors, 12 stages and 92 cases; all 16 validator tests pass. Original commented workflow remains unchanged.
- EGM drift reporting was used, not a formal independent review/convergence loop. New code is limited to roadmap validation/tests; application behavior, private records, runtime dependencies and stack state are unchanged.

### Earlier Planning Pass

The implementation claims below are historical evidence, not a fresh acceptance run. Xavier has rejected the current Maxim application runner as the future foundation and accepted early dashboard/agent, reviewed onboarding, and PostgreSQL/private artifacts/Compose target direction.

- Current planning entry point: [roadmap index](../../roadmap/README.md), [manifesto](../../roadmap/MANIFESTO.md), [high-level stages](../../roadmap/high-level-roadmap.md).
- Research and dependency gates: [external component assessment](../../roadmap/external-components-assessment.md). Ten suggestions assessed; Dossier source copying is AGPL-gated. No candidate runtime packages or Dossier code were added in this planning pass.
- Complete EGM Codex plugin 0.1.1 installed/enabled; manifest, seven skills, agents and standards verified. [Development workflow](../../roadmap/development-workflow.md) preserves its human approval gates. No formal independent EGM review/convergence is claimed.
- [Operational setup checklist](../../roadmap/operational-setup.md) distinguishes current keys, future proposed settings and accounts required only by selected stages. Reuse the existing Discord named maxim applier.
- Existing SQLite/files/native contracts remain current until explicit entity-level migration/cutover evidence. No database migration, application-code retirement, new dashboard, new stack or live integrations were executed here.
- Original commented workflow preserved without edits. New documents retain section comment blocks and miscellaneous additions.
- Validation for this handoff is document/install verification only; product test results below were not rerun and must not be reported as current.
- Planning validation passed: six maintained planning documents; 37 local links/anchors; 71 numbered sections with comment blocks; consistent S0-S11 registers/details; ASCII/fence checks; original commented-workflow SHA-256 unchanged. EGM manifest/version, seven skills, reviewer and standard files verified. Tracked documentation whitespace check passed. No application, provider, browser-site or formal EGM review test is implied.

## Repository Sync

- Local Career-Ops fork path: `d:\VSC Programs\maxim-apply`
- `origin`: `https://github.com/xavier1of1/Maxim-Applier.git`
- `upstream`: `https://github.com/santifer/career-ops.git`
- Working branch: `maxim/v2-career-ops-fork`
- Upstream version check: `node update-system.mjs check` returned `update-available`; local Career-Ops is `1.8.1`, upstream is `1.9.0`. The update has not been applied during Maxim networking feature work.
- Repo naming note: implementation work is in the local `maxim-apply` folder. A check on 2026-06-04 found that `https://github.com/xavier1of1/Maxim-Apply.git` does not exist, while the current `origin` remote still points to `xavier1of1/Maxim-Applier.git`.

## Authority

The prompt referenced v2.0/v1.0 filenames. Those files are compatibility shims in this fork and point to the available current authority:

- `docs/V2 Redesign/maxim_apply_career_ops_redesign_v2_1.md`
- `docs/V2 Redesign/maxim_apply_career_ops_implementation_roadmap_v1_1.md`

## 1. Completed Work

- Controlled Career-Ops fork foundation, upstream remote, working branch, Maxim ADRs, and AGENTS addendum.
- Maxim-owned extension paths under `maxim/`, `data/maxim/`, `docs/maxim/`, and `dashboard/internal/maxim/`.
- Local SQLite store at `data/maxim/maxim.db`, append-only JSONL audit events, and idempotent schema initialization/migration.
- Career-Ops report/tracker/PDF sync adapter with fixture-backed idempotency and PDF path-link validation.
- Career-Ops score-to-Maxim-tier router with T0/T1/T2/T3 thresholds.
- Xavier policy engine for NoVA/DC, Maryland exclusion, Gainesville/Manassas inclusion, salary, clearance, freshness, caution, and connection overlays.
- Salary range policy corrected so ranges starting above the $90k high-conviction floor are accepted when they satisfy the configured target policy.
- Historical CSV/XLSX importer with raw preservation, separate normalized output, import report, SQLite persistence, and audit events.
- Contact ranking and ready-to-send message drafts with manual-only LinkedIn workflow.
- Contact persistence now preserves connection strength, VT alumni, recruiter, founder, role-relevance signals, notes, and raw payload JSON.
- CSV contact import via `maxim:import-contacts`, including Unicode sanitization for malformed local rows.
- LinkedIn/person discovery planner via `npm run maxim:linkedin-find`, generating manual public search URLs for recruiters, hiring managers, peers, VT alumni, and founders without requiring a LinkedIn account.
- Pasted public/LinkedIn people-result parser that normalizes candidate contacts, preserves raw snippets, and can store verified candidates with `--store-results`.
- Career-Ops `contacto` mode now points Claude Code to Maxim-backed `maxim:linkedin-find`, `maxim:networking`, and `maxim:message-drafts` flows while preserving no-login/no-send/no-scrape boundaries.
- Store-backed networking queue generation via `npm run maxim:networking -- --from-store`, selecting T2/T3 and connection-priority Maxim jobs from the local SQLite store.
- Store-backed networking drafts via `npm run maxim:networking -- --from-store --drafts`; these create manual-only draft records and never send LinkedIn/email messages.
- Research-gated networking drafts via `npm run maxim:message-drafts -- research <target_id> --text "..."` followed by `npm run maxim:message-drafts -- from-target <target_id> --require-research`.
- Local `networking_research_notes` records attach approved person/company research to networking targets before draft generation.
- Manual networking draft status tracking via `npm run maxim:message-drafts -- status <draft_id> <status>` for `ready_to_send`, `sent_manually`, `replied`, `follow_up_due`, `referral_asked`, `referred`, `declined`, and `no_response`.
- Networking shortlist reruns preserve already-marked manual statuses instead of resetting sent/replied targets back to ready.
- Contact ranking was tightened so unrelated contacts do not rank merely because the job title contains a software/engineering term.
- SQLite bridge buffer was increased so the store-backed workflow can read the full imported local contact list.
- CSV target-company import via `maxim:import-target-companies`, preserving priority, source preference, connection strength, location focus, role lanes, notes, and raw payload JSON.
- Recruiter inbox manual create/respond/correct flows; Needs Response clears when responded.
- Discord notification planner with dry-run default, urgent/batch/reminder planning, and duplicate suppression.
- Discord live notification validation using local `.env`; duplicate suppression verified.
- Analytics snapshot with NoVA/DC interview-rate KPI, breakdown scaffolding, score band, tier, source, role lane, salary band, freshness, networking, connection, PDF/resume variant, company type, recruiter involvement, and small-sample warnings.
- Operational readiness report via `maxim:operational`, separating runnable system health from real-data blockers.
- Application packet/readiness tracking, assisted-started status, submitted-manually status, duplicate-risk detection, and reapply warning support.
- Assisted apply workflow queue via `npm run maxim:apply-workflow`, automatically creating T2/T3 application records from synced Career-Ops evaluations while keeping final submission manual.
- Guided auto-apply planner via `npm run maxim:auto-apply`, generating approved profile answers, packet links, readiness blockers, stop conditions, and progress commands for queued applications.
- Guided browser form inspector/filler via `npm run maxim:auto-apply-browser`, mapping real application fields, filling known-safe answers, attaching packet PDFs when present, and stopping before the final application action.
- Career-Ops tracker/application sync now enriches tracker rows with matching evaluation score, tier, report path, PDF path, and job URL when reports exist.
- Apply workflow queue now promotes existing `Evaluated` tracker rows into assisted apply records when synced T2/T3 evaluation data is ready.
- Auto-apply profile loading supports ignored `.env` overrides for candidate email, phone, LinkedIn, portfolio, GitHub, relocation preference, and SMS consent.
- Auto-apply planner discovers a local source resume PDF fallback when no tailored Career-Ops PDF is linked, preserving a warning that the attachment is not tailored.
- Local job URL overrides are supported through ignored `data/maxim/job_url_overrides.json`; template added under `data/maxim/templates/`.
- Browser assist supports `--record-started` to mark `assisted_apply_started` and append an audit event after a successful guided fill.
- Browser assist supports `--write-report` to save redacted inspect/assist run reports under ignored `data/maxim/auto-apply-runs/`.
- Browser assist has fixture-backed Playwright coverage for form reveal, approved-field fill, resume attachment, redaction, report writing, and the manual-review stop.
- Browser assist safely handles explicit matching radio/checkbox choices for approved Yes/No answers while keeping self-identification and ambiguous choices in review.
- Browser field extraction supports native fieldset labels and ARIA `group`/`radiogroup` labels for custom choice controls.
- Browser field application now prefers stable field IDs, choice `name`/`value` pairs, and unique names before falling back to DOM index targeting.
- Browser assist follows safe Apply launcher popups/new tabs when the application form opens outside the initial job page.
- Browser assist extracts and fills embedded iframe forms using frame-aware field metadata.
- Browser assist supports styled hidden resume file inputs while hidden non-file helper fields remain skipped.
- Browser assist distinguishes styled hidden upload inputs from fields hidden inside future multi-step sections, so it waits until a step is visible before attaching a resume.
- Browser assist normalizes clear dropdown aliases such as `United States` / `US` and explanatory Yes/No option labels without selecting ambiguous matches.
- Browser assist validates native typed inputs such as date/month/number/email/url before filling; incompatible approved answers stay in manual review instead of triggering browser fill errors.
- Browser assist can advance through bounded multi-step forms by clicking only safe non-final `Next`/`Continue` controls, then stops before submit/finish/apply controls or any required manual-review field.
- Browser assist maps conservative nearby visual label text for unlabeled ATS fields, improving safe fill coverage without using whole-page text as a label.
- Browser assist records individual field-application failures instead of aborting the whole run when an ATS control changes shape during filling.
- `--record-started` now records `assisted_apply_started` only when at least one known-safe field was actually filled on a usable page; blocked/no-fill runs remain reports only.
- Browser assist CLI output and saved run reports include a review checklist split into required fields, optional fields, failed fields, final controls, stop reasons, and next manual actions.
- Auto-apply known answers now separate street address, city, state, postal code, country, and education fields; private address fields are optional, locally configurable, and redacted from plan/report output.
- Website/platform safety scanner for no LinkedIn send automation, no full auto-submit, no CAPTCHA bypass, no anti-bot evasion, no unbounded retry, and no high-frequency polling patterns.
- Alignment guard for authority docs, package scripts, schema, local-first data, patch boundaries, and safety checks.
- One-command job intake wrapper via `maxim:evaluate-job`, accepting public job URLs or saved JD files and running evaluation, tracker merge, Maxim sync, analytics, dashboard state, and operational readiness.
- Integrated Go dashboard Maxim mode with Today, High Conviction, Networking, Recruiter Inbox, Applications, Analytics, and Settings views.
- Dashboard snapshot bridge via `npm run maxim:dashboard-state`.
- Dashboard render tests for every Maxim view and useful empty states.
- Fixture E2E validation via `npm run maxim:e2e`.
- Operational templates:
  - `data/maxim/templates/contacts.example.csv`
  - `data/maxim/templates/target_companies.example.csv`
  - `data/maxim/templates/application_outcomes.example.csv`
  - `data/maxim/templates/evidence_claims.example.yml`
  - `data/maxim/templates/linkedin_people_results.example.txt`
  - `data/maxim/templates/prior_outreach_examples.example.md`
- Operational docs:
  - `docs/maxim/data_onboarding_guide.md`
  - `docs/maxim/assisted_apply_workflow.md`
  - `docs/maxim/release_candidate_checklist.md`
  - `docs/maxim/testing/dashboard-smoke-test.md`
  - `docs/maxim/dashboard_validation_report.md`
  - `docs/maxim/end_to_end_validation.md`
  - `docs/maxim/networking_validation.md`
  - `docs/maxim/analytics_validation.md`
  - `docs/maxim/operator_guide.md`
  - `docs/maxim/gap_analysis.md`

## 2. Partially Completed Work

- Dashboard write actions remain CLI-backed; Maxim dashboard views are read-only for now. Assisted apply state changes use `maxim:application`.
- Dashboard automated Go tests pass, but the interactive TUI still needs manual visual smoke testing in a terminal.
- Analytics are structurally implemented and fixture-validated, but real conclusions require real NoVA/DC-compatible application/outcome data.
- Evidence safety is enforced by docs/templates and claim restrictions, but detailed claims still need user approval before generated materials rely on them.
- Real contacts have been imported locally; real target-company and historical data are present locally but need user review before strategic use.

## 3. Commands Run And Results

- `node update-system.mjs check` -> passed; Career-Ops `1.8.1` is up to date.
- `npm run doctor` -> passed.
- `npm run verify` -> passed; 4 tracker rows, 0 errors, 0 warnings.
- `npm run maxim:doctor` -> passed with operational readiness warnings for missing real reports, PDFs, and tracker rows.
- `node --test maxim/tests/unit/application-form-mapper.test.mjs` -> passed; mapper tests include typed native inputs, private address holds, education fields, hidden future-step files, nearby visual labels, choice groups, and styled hidden resume inputs.
- `node --test maxim/tests/unit/auto-apply-planner.test.mjs` -> passed; 6 tests including browser command generation and private profile env overrides.
- `node --test maxim/tests/integration/auto-apply-browser-fixture.test.mjs` -> passed; browser guided apply filled approved fixture fields, attached the resume PDF, handled popups/iframes/choices/unlabeled visual labels, advanced a safe multi-step fixture, detected final submit controls, captured per-field failures, wrote a redacted report with a review checklist, and stopped for Xavier review.
- `npm run maxim:test` -> passed; 62 tests.
- `npm run maxim:safety` -> passed; no prohibited automation findings.
- `npm run maxim:alignment` -> passed; 0 issues, 0 warnings.
- `npm run maxim:auto-apply -- prepare --limit 10` -> passed; synced 4 evaluations, promoted 2 eligible T2/T3 applications, skipped 2 T1 roles, and produced enriched plans with URLs/scores/tiers.
- `npm run maxim:auto-apply -- plan --limit 5` -> passed; returned enriched held plans with exact readiness blockers.
- `npm run maxim:auto-apply -- plan --ready-only` -> passed; returned 0 ready plans.
- `npm run maxim:auto-apply -- doctor` -> completed; `ok: false` because real local email and phone are not configured, while fallback resume detection is present and private values are not printed.
- Dummy-env readiness proof using `MAXIM_CANDIDATE_EMAIL`, `MAXIM_CANDIDATE_PHONE`, `MAXIM_CANDIDATE_LINKEDIN`, `MAXIM_RELOCATION_OPEN`, and `MAXIM_SMS_CONSENT` -> passed; Sitreps and Palantir become `ready_for_guided_apply` at the plan layer.
- `npm run maxim:auto-apply-browser -- assist app_2a2b0f284735db03` with dummy env values -> passed against real Sitreps Greenhouse form; filled/attached 13 known-safe fields, left veteran/self-ID for review, skipped helper/challenge fields, and stopped before the final application action.
- `npm run maxim:auto-apply-browser -- inspect app_2a2b0f284735db03 --force --write-report` -> passed against real Sitreps Greenhouse form; wrote a redacted report, mapped 23 fields, identified 8 safe-fill candidates, and held email, phone, LinkedIn, relocation, veteran/self-identification, and SMS consent for review/configuration.
- Greenhouse phone-field regression check -> passed; phone fieldset helper controls are skipped, Country maps to country, and only the real Phone field remains blocked when phone is missing.
- Dynamic ATS helper-field fixture -> passed; browser assist still attaches the resume to the intended file input after the page inserts a helper field during filling.
- Apply launcher popup fixture -> passed; browser assist follows a safe `Apply for this job` launcher into the popup form, fills approved fields, attaches the resume, and stops for review.
- Embedded iframe fixture -> passed; browser assist maps fields inside an iframe, fills approved answers, attaches the resume, and stops for review.
- Hidden resume-upload fixture -> passed; browser assist attaches the resume through a styled hidden file input while hidden non-file helper fields remain skipped.
- Dropdown alias fixture -> passed; browser assist selects `United States of America` for `United States` and explanatory No-sponsorship dropdown labels for approved No answers.
- `npm run maxim:auto-apply-browser -- inspect app_274568054d96d0b0 --force` -> passed; official Palantir Lever URL is currently a removed/404 posting and is classified as `posting_unavailable_or_removed`.
- `npm run maxim:dashboard-state` -> passed; exported live dashboard DTO snapshot with 4 applications.
- `npm run maxim:e2e` -> passed; fixture workflow proved sync, T3 tiering, dashboard visibility, networking draft, recruiter thread, analytics, and notification planning.
- `npm run maxim:sync` -> passed; 1 BLEN evaluation and 1 application after real Career-Ops artifact generation.
- `npm run maxim:tier -- --score 4.6 --location "Arlington, VA" --salary "95000-125000" --posted-at "2026-06-01T12:00:00Z"` -> passed; T3, urgent high-conviction action, positive location/salary/freshness explanation.
- `npm run maxim:analytics` -> passed; denominator 0 with small-sample warning.
- `npm run maxim:operational` -> passed; `operationalReady: true` with 17/18 checks passing and no hard blockers. Remaining non-hard gap: application outcomes CSV has 0 rows.
- `npm run maxim:evaluate-job -- jds\blen-senior-software-developer-full-stack-2026-06-03.txt` -> wrapper path exercised; Windows argument handling fixed and unsafe unknown-report tracker writes now blocked.
- `npm run maxim:notify` -> passed in dry-run mode; planned the 3-week resume/PDF variant review placeholder.
- `node maxim/scripts/discord-notify.mjs` -> passed live with `.env`; first run sent one safe reminder and second run sent zero due duplicate suppression.
- `npm run maxim:import-contacts -- data\maxim\contacts.csv --no-store` -> passed; parsed 747 contacts.
- `npm run maxim:import-contacts -- data\maxim\contacts.csv` -> passed; imported 747 local contacts into ignored SQLite store.
- `npm run maxim:import-target-companies -- data\maxim\target_companies.csv --no-store` -> passed; parsed 176 target companies.
- `npm run maxim:import-target-companies -- data\maxim\target_companies.csv` -> passed; imported 176 local target companies into ignored SQLite store.
- `npm run maxim:import-history -- maxim\tests\fixtures\history-sample.csv` -> passed; 2 raw rows, 2 normalized rows, 1 interview signal.
- `npm run maxim:networking -- maxim\tests\fixtures\networking-job.json maxim\tests\fixtures\networking-contacts.json --no-store` -> passed; ranked fixture contacts without storing or sending anything.
- `npm run maxim:message-drafts -- maxim\tests\fixtures\message-draft-payload.json --no-store` -> passed; five-part draft validation succeeded and manual-only check passed.
- `node --test maxim\tests\unit\linkedin-connection-finder.test.mjs` -> passed; search tasks, role-lane inference, pasted result parsing, and combined discovery are covered.
- `npm run maxim:linkedin-find -- --company "Federal Platform Labs" --role "Software Engineer, Mission Systems" --results maxim\tests\fixtures\linkedin-people-results.txt --no-store` -> passed; generated manual search tasks and parsed 3 candidate contacts without logging in, scraping, storing, or sending.
- `node --test maxim\tests\unit\contact-ranker.test.mjs maxim\tests\unit\message-builder.test.mjs maxim\tests\integration\networking-store.test.mjs maxim\tests\integration\dashboard-snapshot.test.mjs` -> passed; store-backed networking queue creates manual drafts, preserves sent status on rerun, and dashboard DTOs expose draft status.
- `npm run maxim:networking -- --from-store --drafts --no-store --limit-jobs 2 --limit-contacts 2` -> passed; dry-run over the local store considered 2 T2/T3 jobs and 816 contacts, produced 4 ranked manual-only draft candidates, and wrote nothing.
- `npm run maxim:networking -- --from-store --drafts --require-research --no-store --limit-jobs 1 --limit-contacts 1` -> passed; produced a research-required warning instead of creating a draft without an approved note.
- `npm run maxim:message-drafts -- list --status ready_to_send` -> passed; status CLI works and currently shows 0 persisted ready-to-send drafts because the store-backed validation was dry-run.
- `npm run maxim:recruiter-inbox -- needs-response` -> passed; empty list.
- `npm run maxim:application -- list` -> passed; empty list.
- `go version` -> passed; Go `1.26.4`.
- `gofmt -h` -> passed.
- `gofmt -l internal\maxim\model.go internal\maxim\service\service.go` -> passed; no Maxim-owned Go files listed.
- `go test ./...` from `dashboard/` -> passed.
- `dashboard/internal/maxim/model_test.go` -> proves Today, High Conviction, Networking, Recruiter Inbox, Applications, Analytics, Settings, and empty-state render paths.
- `go run . -path ..` from `dashboard/` -> launched the interactive TUI and timed out in the non-interactive shell; manual smoke test documented in `docs/maxim/testing/dashboard-smoke-test.md`.

## 4. Tests Passing Or Failing

- Passing: native Career-Ops doctor and tracker verification.
- Passing: Maxim unit, integration, safety, alignment, sync fixture, networking fixture, history fixture, target-company import, operational readiness, and dashboard snapshot tests.
- Passing: Go dashboard package tests.
- Not screenshot-captured: interactive TUI visual smoke test, because the Bubble Tea dashboard requires a real terminal session. Automated render tests cover screen text paths.
- Passing: live Discord send path and duplicate suppression.

## 5. Real Data Still Needed

- User approval of resume/evidence claims from local resume imports and `article-digest.md`.
- Real Career-Ops reports under `reports/`.
- Real tailored Career-Ops PDFs under `output/`.
- Additional real rows in `data/applications.md` beyond the BLEN validation row.
- Candidate email, phone, and LinkedIn URL in local `config/profile.yml` or `.env` before guided apply plans can produce complete contact answers.
- Optional private address fields for higher ATS fill coverage: `MAXIM_CANDIDATE_STREET_ADDRESS`, `MAXIM_CANDIDATE_CITY`, `MAXIM_CANDIDATE_STATE`, `MAXIM_CANDIDATE_POSTAL_CODE`, and `MAXIM_CANDIDATE_COUNTRY`.
- Optional local choices for relocation openness and SMS/text-message consent in `config/profile.yml`.
- Real contact/preference values in `.env` or `config/profile.yml` before real browser assist should be run without dummy data.
- Tailored Career-Ops PDFs remain preferred for Sitreps and Palantir, but a local source resume PDF fallback is available and validated.
- User-reviewed historical tracker import/interpretation.
- User-reviewed target-company/source preference list; local target-company CSV is imported but strategic interpretation remains unapproved.
- Prior outreach examples approved as style references.
- Optional per-contact/person research notes before persisting drafts at scale; current draft builder uses conservative contact/company context when no specific research text is supplied.
- Application outcomes and interview rounds for meaningful analytics denominators.
- Real recruiter emails/threads if Gmail-style ingestion is desired later.

## 6. Dashboard Validation Status

- Go is installed and the dashboard compiles/tests successfully.
- Maxim-owned Go files are gofmt-clean.
- `maxim:dashboard-state` produces the DTO snapshot consumed by the dashboard service.
- Automated dashboard render tests cover every Maxim view.
- The dashboard TUI manual smoke test remains the next validation step:

```powershell
cd "d:\VSC Programs\maxim-apply"
npm run maxim:dashboard-state
cd dashboard
go run . -path ..
```

Press `m` inside the native Career-Ops pipeline to enter Maxim Apply mode.

## 7. Discord Live Validation Status

- Dry-run notification planning passes.
- Direct live notification sending loads `.env` through `dotenv/config`.
- Live validation completed on 2026-06-03; duplicate suppression verified on a second live run.

## 8. Known Limitations

- One real BLEN report/PDF/tracker row exists and syncs; more real evaluated roles are needed for day-to-day use.
- Current Sitreps and Palantir application records are correctly enriched and queued. With real contact/preference values present, Sitreps can be browser-assisted using the local source resume PDF fallback.
- Current Palantir URL resolves to an official Lever posting that is removed/404, so it should be refreshed or replaced before applying.
- Current BLEN and Metron records remain T1 strategic-override holds by score/tier policy.
- No real approved evidence bank is present yet, so resume/application materials remain evidence-gated.
- Real contacts are present and imported locally.
- Target-company data exists locally and is imported; historical source data exists locally, but both require user review before strategic conclusions.
- Dashboard write actions are future work; use CLI commands for mutations.
- Analytics should not be used for strategy changes until enough real NoVA/DC-compatible outcomes exist.
- LinkedIn sending, full auto-submit, CAPTCHA bypass, anti-bot evasion, and fabricated candidate claims remain explicitly out of scope.
- The new apply workflow and guided auto-apply planner queue, prepare, and track assisted manual submission; they are not final submission executors.

## 9. Next Recommended Steps

1. Run the manual dashboard smoke test in an interactive terminal.
2. Add approved evidence and resume material locally.
3. Generate at least one real Career-Ops report/PDF and run `npm run maxim:sync`.
4. Review/approve the evidence bank and historical/target-company inputs.
5. Re-run `npm run maxim:doctor`, `npm run maxim:dashboard-state`, and `npm run maxim:analytics`.

## 10. Phase 11 Future Executor Assessment

Phase 11 is not ready for implementation. A future executor assessment should only begin after real usage data shows that manual submission remains the primary bottleneck after the assisted Career-Ops apply workflow, Maxim dashboard, networking queue, recruiter tracking, Discord notifications, and analytics are operating with real data.

## Assumptions

- v2.1/v1.1 are the latest available authority documents.
- SQLite via Python standard-library `sqlite3` is acceptable to avoid a new production npm dependency.
- User-layer files and real Maxim data remain local-first and ignored by git.
- No secrets are committed.
