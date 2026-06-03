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
