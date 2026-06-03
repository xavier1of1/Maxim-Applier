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
- Implemented networking contact ranking and five-part ready-to-send draft validation.
- Implemented recruiter thread state helpers.
- Implemented dry-run Discord notification planner with duplicate suppression.
- Implemented analytics snapshot helper with NoVA/DC interview-rate KPI and small-sample warnings.
- Implemented application packet and duplicate-risk helpers.
- Implemented platform safety scanner for prohibited LinkedIn sending, auto-submit, CAPTCHA bypass, and anti-bot evasion patterns.
- Added isolated native Go dashboard Maxim mode under `dashboard/internal/maxim`.
- Added a small Career-Ops dashboard hook: press `m` from the pipeline to open Maxim mode; press `m`, `q`, or `esc` to return.

## Not Completed

- Real Discord sends require `MAXIM_DISCORD_WEBHOOK_URL`.
- LinkedIn sending and full auto-submit are intentionally not implemented.
- Node-side historical import supports CSV. XLSX import can be added later with a deliberate dependency or a Python helper.
- Career-Ops reports/PDFs are not present beyond `.gitkeep` in the fresh fork, so `maxim:sync` currently has no real artifacts to ingest.

## How To Run

```powershell
cd "d:\VSC Programs\maxim-apply"
npm run doctor
npm run verify
npm run maxim:doctor
npm run maxim:sync
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
- `npm run maxim:test` -> 12 passed.
- `npm run maxim:doctor` -> passed with no warnings.
- `npm run maxim:safety` -> passed with no prohibited automation findings.
- `npm run maxim:sync` -> passed; 0 evaluations and 0 applications because this fresh fork has no real reports/tracker rows yet.
- `npm run maxim:tier -- --score 4.6 --location 'Arlington, VA' --salary '$95,000 - $125,000' --posted-at '2026-06-01T12:00:00Z'` -> produced `T3` and urgent high-conviction next action.
- `npm run maxim:analytics` -> passed on empty data with a small-sample warning.
- `npm run maxim:notify` -> dry-run passed and planned the 3-week resume/PDF variant reminder placeholder.
- `npm run verify` -> passed; reported no `data/applications.md`, which is normal for a fresh setup.
- `npm run doctor` -> failed with expected onboarding issues:
  - dependencies not installed,
  - Playwright Chromium not installed,
  - `cv.md` missing,
  - `config/profile.yml` missing,
  - `portals.yml` missing.
- `go version` and `gofmt` were unavailable on this machine, so native Go dashboard formatting/tests could not be run locally.

## Remaining Manual Setup Steps

- Confirm the GitHub repo is private in GitHub settings.
- Push branch `maxim/v2-career-ops-fork` to `origin`.
- Run `npm install`.
- Run `npx playwright install chromium`.
- Provide `MAXIM_DISCORD_WEBHOOK_URL` for live Discord notifications.
- Add Xavier user-layer files:
  - `cv.md`
  - `config/profile.yml`
  - `modes/_profile.md`
  - `portals.yml`
- Provide approved evidence/resume claims before trusting generated materials.
- Provide contact list and target-company list for networking output.
- Generate or import real Career-Ops reports/PDFs/tracker rows for `maxim:sync`.

## Assumptions

- This fork preserves Career-Ops core files and adds Maxim in isolated extension paths.
- v2.1/v1.1 are the latest available authority documents.
- SQLite uses Python standard-library `sqlite3` from Node scripts to avoid adding a new production npm dependency.
- No secrets are committed.
