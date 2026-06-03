# Dashboard Test Plan

Last updated: 2026-06-03

## Scope

This plan protects the Maxim Apply mode inside the native Career-Ops Go dashboard.

## Required Coverage

- Native Career-Ops dashboard still opens and preserves pipeline navigation.
- Pressing `m` from the Career-Ops pipeline opens Maxim Apply mode.
- Pressing `m`, `q`, or `esc` from Maxim mode returns to Career-Ops.
- Maxim mode exposes Today, High Conviction, Networking, Recruiter Inbox, Applications, Analytics, and Settings.
- Dashboard screens consume `DashboardService` DTOs rather than parsing raw Career-Ops reports or querying SQLite directly.
- Empty states are useful when no Career-Ops reports, Maxim jobs, networking records, recruiter threads, applications, or metric snapshots exist.
- `npm run maxim:dashboard-state` exports `data/maxim/dashboard-state.json` for store-backed DTOs.
- Dashboard service falls back to Career-Ops tracker rows when no Maxim dashboard snapshot exists.

## Manual Verification

```powershell
cd "d:\VSC Programs\maxim-apply"
npm run maxim:dashboard-state
cd dashboard
go test ./...
go run . -path ..
```

Inside the dashboard:

- Confirm the native pipeline loads.
- Press `m`.
- Confirm Maxim Apply mode opens.
- Navigate tabs with arrow keys or `h`/`l`.
- Confirm each tab renders without broken text or panic.
- Press `m`, `q`, or `esc` to return.

## Current Limitation

Go/gofmt are not installed in the current Windows environment, so Go formatting and dashboard tests must be run after Go is installed.
