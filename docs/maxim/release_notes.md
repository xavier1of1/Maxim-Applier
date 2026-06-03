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
- Recruiter inbox manual tracking and Needs Response workflow.
- Discord notification planner with dry-run default and duplicate suppression.
- Analytics snapshots with NoVA/DC interview-rate KPI and small-sample warning.
- Manual application tracking with packet readiness and duplicate-risk visibility.
- Maxim mode inside the native Career-Ops Go dashboard.
- `DashboardService` DTO seam and `maxim:dashboard-state` snapshot bridge.
- Safety and alignment checks.
- Operational data templates for contacts, target companies, application outcomes, evidence claims, and prior outreach examples.
- Data onboarding guide, release candidate checklist, and dashboard smoke-test documentation.
- Contact store persistence for VT alumni, recruiter, founder, role-relevance, and raw contact payload signals.
- Fixture-backed CLI smoke paths for networking shortlist and message drafts.
- Sync fixture validation for report-to-PDF path linking.
- Operational readiness warnings in `maxim:doctor`.
- `maxim:import-contacts` for local CSV contact ingestion with connection strength, VT alumni, recruiter, founder, role-relevance, and Unicode sanitization.
- `maxim:import-target-companies` for local CSV target-company ingestion with priority/source/location/role-lane context.
- `maxim:operational` for a single readiness report that distinguishes runnable system health from missing real-data blockers.
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
- Dashboard `go test ./...` passes with Go `1.26.4`.
- Interactive dashboard smoke testing remains manual.
