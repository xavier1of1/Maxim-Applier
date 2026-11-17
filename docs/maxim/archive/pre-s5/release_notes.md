# Maxim Apply Release Notes

## v0.1 Career-Ops Fork Foundation

Date: 2026-06-03

### Added

- Controlled Career-Ops fork structure for Maxim Apply.
- Maxim authority docs, ADRs, implementation status, alignment audit, and setup docs.
- Local-first SQLite extension store and JSONL event log under ignored `data/maxim/`.
- Idempotent Career-Ops report/tracker sync adapter.
- Career-Ops score to Maxim tier mapping.
- Xavier policy engine for NoVA/DC, salary, clearance, freshness, and priority overlays.
- Historical CSV/XLSX import with raw preservation and normalized rows.
- Networking shortlist and manual message draft queue.
- Account-free LinkedIn/person discovery planner through `maxim:linkedin-find`.
- Pasted public/LinkedIn people-result parser for creating local candidate contacts without login, scraping, or sending.
- Store-backed networking queue generation from local T2/T3 and connection-priority Maxim jobs.
- Local networking research notes attached to targets, jobs, and contacts.
- Research-gated target-specific draft generation through `maxim:message-drafts -- from-target <target_id> --require-research`.
- Manual networking draft status CLI for ready/sent/replied/follow-up/referral/declined/no-response tracking.
- Idempotent networking reruns that preserve manual draft and target statuses.
- Recruiter inbox manual tracking and Needs Response workflow.
- Discord notification planner with dry-run default and duplicate suppression.
- Analytics snapshots with NoVA/DC interview-rate KPI and small-sample warning.
- Manual application tracking with packet readiness and duplicate-risk visibility.
- Guided auto-apply planning via `maxim:auto-apply`, using approved local profile answers, packet links, review blockers, and manual final-action stop conditions.
- Guided browser form inspection/fill via `maxim:auto-apply-browser`, with field mapping, known-answer fills, packet attachment support, portal stop reasons, and no final application action.
- Safe explicit radio/checkbox choice handling for approved Yes/No answers, with self-identification and ambiguous choices held for review.
- Choice-field extraction supports native fieldset labels and ARIA group/radiogroup labels used by custom ATS forms.
- Browser field targeting prefers stable IDs, choice `name`/`value` pairs, and unique names before using DOM index fallback.
- Safe Apply launcher popup/new-tab following for pages that open the application form separately.
- Embedded iframe form extraction and filling for ATS pages that host application fields inside frames.
- Styled hidden resume upload input support while hidden non-file helpers remain skipped.
- Hidden future-step file inputs are skipped until the step is visible, while styled hidden resume uploads remain attachable.
- Native typed input validation for date, month, number, email, and URL fields before browser fill.
- Bounded multi-step browser assist for safe non-final `Next`/`Continue` controls, with final submit/finish/apply controls detected and left for Xavier.
- Conservative nearby visual-label extraction for unlabeled ATS fields.
- Per-field browser application failure capture so one changed control does not abort the entire guided run.
- Safer `--record-started` behavior: records started only after an actual known-safe field fill on a usable page.
- Review checklist output in browser assist CLI/results, separating required fields, optional fields, failed fields, final controls, stop reasons, and next manual actions.
- Normalized dropdown matching for clear aliases such as `United States` -> `United States of America` / `US` and explanatory Yes/No options.
- Redacted browser run reports via `maxim:auto-apply-browser --write-report`.
- Fixture-backed browser assist test covering form reveal, approved-field fill, resume attachment, redaction, report writing, and the manual-review stop.
- Auto-apply profile doctor and `.env` overrides for private contact/preferences.
- Auto-apply profile support for optional private address fields and approved education fields, with address values redacted from plans/reports.
- Local source resume PDF fallback when no tailored Career-Ops PDF is linked.
- Local job URL override support for replacing aggregator URLs with official ATS postings.
- Maxim mode inside the native Career-Ops Go dashboard.
- `DashboardService` DTO seam and `maxim:dashboard-state` snapshot bridge.
- Safety and alignment checks.
- Operational data templates for contacts, target companies, application outcomes, evidence claims, and prior outreach examples.
- Data onboarding guide, release candidate checklist, and dashboard smoke-test documentation.
- Contact store persistence for VT alumni, recruiter, founder, role-relevance, and raw contact payload signals.
- Contact ranker guard against broad role-title matches making unrelated contacts appear relevant.
- Fixture-backed CLI smoke paths for networking shortlist and message drafts.
- Fixture-backed LinkedIn finder tests for role-lane inference, manual search task generation, pasted-result parsing, and combined local/pasted discovery.
- Sync fixture validation for report-to-PDF path linking.
- Operational readiness warnings in `maxim:doctor`.
- `maxim:import-contacts` for local CSV contact ingestion with connection strength, VT alumni, recruiter, founder, role-relevance, and Unicode sanitization.
- `maxim:import-target-companies` for local CSV target-company ingestion with priority/source/location/role-lane context.
- `maxim:operational` for a single readiness report that distinguishes runnable system health from missing real-data blockers.
- `maxim:evaluate-job` for one-command job intake from a public URL or saved JD file.
- `maxim:e2e` for fixture-based end-to-end validation.
- Dashboard render tests for every Maxim view.
- Analytics segmentation for score band, salary band, freshness, PDF variant, company type, and recruiter involvement.
- Dashboard validation, end-to-end validation, networking validation, analytics validation, operator guide, and gap analysis docs.

### Preserved

- Career-Ops scoring remains authoritative.
- Career-Ops scanner, PDF generation, tracker scripts, apply assistant, modes, and native dashboard behavior remain intact.
- User-layer files remain local-only and ignored by git.

### Intentionally Not Added

- No LinkedIn message sending.
- No full application auto-submit.
- No CAPTCHA bypass.
- No anti-bot evasion.
- No fabricated candidate claims or active-clearance claims.

### Validation Update

- Native Career-Ops `doctor` and `verify` pass.
- Maxim tests, safety, alignment, E2E validation, dashboard snapshot, sync, tier, analytics, operational readiness report, notification dry-run/live, contact import, fixture history import, fixture networking, and fixture message-draft commands pass.
- Store-backed networking dry-run over local contacts/jobs passes without sending or persisting messages.
- Research-gated networking dry-run and integration tests pass; drafts are held until approved research exists when required.
- LinkedIn finder fixture command passes without login, scraping, storing, or sending.
- Dashboard `go test ./...` passes with Go `1.26.4`.
- Interactive dashboard smoke testing remains manual.
