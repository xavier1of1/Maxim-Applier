# Maxim Apply Implementation Status

Last updated: 2026-06-03

## Repository Sync

- Local Career-Ops fork path: `d:\VSC Programs\maxim-apply`
- `origin`: `https://github.com/xavier1of1/Maxim-Applier.git`
- `upstream`: `https://github.com/santifer/career-ops.git`
- Working branch: `maxim/v2-career-ops-fork`
- Upstream version check: `node update-system.mjs check` returned `up-to-date` for Career-Ops `1.8.1`.

## Authority Assumption

The setup prompt referenced v2.0/v1.0 document filenames, but the available source workspace contained v2.1/v1.1 documents. This fork includes compatibility files at the requested v2.0/v1.0 paths, and the actual current authority remains:

- `docs/V2 Redesign/maxim_apply_career_ops_redesign_v2_1.md`
- `docs/V2 Redesign/maxim_apply_career_ops_implementation_roadmap_v1_1.md`

## Completed

- Cloned the Career-Ops-based private repo.
- Added `upstream` remote pointing to `santifer/career-ops`.
- Created branch `maxim/v2-career-ops-fork`.
- Added `MAXIM_APPLY.md`.
- Added Maxim fork ADRs and testing docs under `docs/maxim/`.
- Added operational input tracker under `docs/V2 Redesign/maxim_apply_operational_inputs_needed.md`.
- Added Maxim-owned local data skeleton under `data/maxim/`.
- Added root npm scripts:
  - `maxim:doctor`
  - `maxim:sync`
  - `maxim:tier`
  - `maxim:import-history`
  - `maxim:networking`
  - `maxim:message-drafts`
  - `maxim:recruiter-inbox`
  - `maxim:application`
  - `maxim:notify`
  - `maxim:analytics`
  - `maxim:safety`
  - `maxim:test`
- Implemented local SQLite extension store at `data/maxim/maxim.db`, ignored by git.
- Implemented append-only event logging under `data/maxim/events/`, ignored by git except `.gitkeep`.
- Implemented tolerant Career-Ops report/tracker parser and idempotent sync.
- Implemented Career-Ops score-to-tier routing:
  - `< 3.5` -> `T0`
  - `3.5-3.9` -> `T1`
  - `4.0-4.4` -> `T2`
  - `4.5+` -> `T3`
- Implemented Maxim policy flags for NoVA/DC location, salary, clearance, freshness, connection overlays, and caution categories.
- Implemented networking contact ranking, contact/shortlist persistence, and five-part ready-to-send draft validation.
- Implemented message-draft persistence for manual LinkedIn/accountability workflows; no send path exists.
- Implemented recruiter thread state helpers plus persisted manual create/respond/correct flows.
- Implemented dry-run Discord notification planner with duplicate suppression, backed by stored high-conviction jobs, ready drafts, and recruiter response reminders.
- Implemented historical tracker import for CSV and XLSX using local-only raw copies, separate normalized JSON output, SQLite batch/row persistence, and audit events.
- Implemented analytics snapshot helper with NoVA/DC interview-rate KPI and small-sample warnings.
- Implemented application packet, duplicate-risk helpers, and manual application status tracking for packet-created, assisted-started, and submitted-manually states.
- Implemented platform safety scanner for prohibited LinkedIn sending, auto-submit, CAPTCHA bypass, and anti-bot evasion patterns.
- Added isolated native Go dashboard Maxim mode under `dashboard/internal/maxim`.
- Added a small Career-Ops dashboard hook: press `m` from the pipeline to open Maxim mode; press `m`, `q`, or `esc` to return.
- Installed local Node dependencies with `npm install`.
- Installed Playwright Chromium with `npx playwright install chromium`.
- Created local user-layer Career-Ops onboarding files:
  - `cv.md`
  - `config/profile.yml`
  - `modes/_profile.md`
  - `portals.yml`
  - `data/applications.md`
- The local `cv.md` is intentionally evidence-gated and contains only approved high-level positioning plus restrictions. Detailed resume claims remain pending approved source material.

## Not Completed

- Real Discord sends require `MAXIM_DISCORD_WEBHOOK_URL`.
- LinkedIn sending and full auto-submit are intentionally not implemented.
- Career-Ops reports/PDFs are not present beyond `.gitkeep` in the fresh fork, so `maxim:sync` currently has no real artifacts to ingest.
- Native Go dashboard tests still require Go/gofmt to be installed locally.

## How To Run

```powershell
cd "d:\VSC Programs\maxim-apply"
npm run doctor
npm run verify
npm run maxim:doctor
npm run maxim:sync
npm run maxim:import-history -- path\to\historical-tracker.xlsx
npm run maxim:networking -- path\to\job.json path\to\contacts.json
npm run maxim:message-drafts -- path\to\draft-payload.json
npm run maxim:recruiter-inbox -- create "Recruiter reply" "Company"
npm run maxim:application -- create career_ops_evaluation_id
npm run maxim:tier -- --score 4.6 --location 'Arlington, VA' --salary '$95,000 - $125,000'
npm run maxim:analytics
npm run maxim:notify
npm run maxim:safety
```

Native dashboard:

```powershell
cd "d:\VSC Programs\maxim-apply\dashboard"
go test ./...
go run .
```

Press `m` inside the pipeline dashboard to enter Maxim Apply mode.

## How To Test

```powershell
cd "d:\VSC Programs\maxim-apply"
npm run maxim:test
npm run maxim:safety
npm run doctor
npm run verify
cd dashboard
go test ./...
```

## Verification Run

- `node update-system.mjs check` -> `up-to-date`, local and remote Career-Ops `1.8.1`.
- `npm run maxim:test` -> 20 passed.
- `npm run maxim:doctor` -> passed with no warnings.
- `npm run maxim:safety` -> passed with no prohibited automation findings.
- `npm run maxim:sync` -> passed; 0 evaluations and 0 applications because this fresh fork has no real reports/tracker rows yet.
- `npm run maxim:tier -- --score 4.6 --location 'Arlington, VA' --salary '$95,000 - $125,000' --posted-at '2026-06-01T12:00:00Z'` -> produced `T3` and urgent high-conviction next action.
- `npm run maxim:analytics` -> passed on empty data with a small-sample warning.
- `npm run maxim:notify` -> dry-run passed and planned the 3-week resume/PDF variant reminder placeholder.
- `npm run verify` -> passed; reported no `data/applications.md`, which is normal for a fresh setup.
- `npm install` -> passed.
- `npx playwright install chromium` -> passed.
- `npm run doctor` -> passed after local user-layer onboarding files were created.
- `npm run verify` -> passed after `data/applications.md` was created; 0 tracker rows, 0 errors, 0 warnings.
- `npm run maxim:import-history -- maxim/tests/fixtures/history-sample.csv` -> passed; copied raw CSV, wrote separate normalized JSON, and stored 2 raw/normalized rows with 1 interview signal.
- Networking store integration test -> passed; persisted one contact, one networking target, one ready-to-send manual draft, and an audit event.
- Recruiter/notification store integration tests -> passed; Needs Response clears on respond, and notification planning reads stored jobs, ready drafts, and recruiter reminders.
- Application tracker integration tests -> passed; records preserve Career-Ops score/tier, duplicate risk is visible, and submission is a manual status only.
- `go version` and `gofmt` were unavailable on this machine, so native Go dashboard formatting/tests could not be run locally.

## Remaining Manual Setup Steps

- Confirm the GitHub repo is private in GitHub settings.
- Push branch `maxim/v2-career-ops-fork` to `origin`.
- Provide `MAXIM_DISCORD_WEBHOOK_URL` for live Discord notifications.
- Provide approved evidence/resume claims before trusting generated materials.
- Provide contact list and target-company list for networking output.
- Generate real Career-Ops reports/PDFs/tracker rows for `maxim:sync`.
- Import Xavier's real historical tracker with `npm run maxim:import-history -- path\to\tracker.xlsx`.
- Install Go locally to run dashboard `gofmt` and `go test ./...`.

## Assumptions

- This fork preserves Career-Ops core files and adds Maxim in isolated extension paths.
- v2.1/v1.1 are the latest available authority documents.
- SQLite uses Python standard-library `sqlite3` from Node scripts to avoid adding a new production npm dependency.
- No secrets are committed.
- User-layer files are ignored by git according to Career-Ops' data contract and exist only in the local working copy.
