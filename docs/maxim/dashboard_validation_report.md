# Maxim Dashboard Validation Report

Last updated: 2026-06-03

## Status

Dashboard validation is COMPLETE for compile, package tests, snapshot DTO loading, and automated Maxim screen rendering. Manual interactive visual inspection is still recommended because the dashboard is a Bubble Tea terminal UI.

## Commands Run

```powershell
cd "d:\VSC Programs\maxim-apply"
npm run maxim:dashboard-state
cd dashboard
go version
gofmt -w .
go test ./...
go run . -path ..
```

## Observed Results

- `go version` returned Go `1.26.4`.
- `gofmt -w .` completed.
- `go test ./...` passed.
- `dashboard/internal/maxim/model_test.go` proves:
  - Maxim mode renders from a dashboard snapshot.
  - Today view renders.
  - High Conviction view renders.
  - Networking view renders.
  - Recruiter Inbox renders.
  - Applications view renders.
  - Analytics view renders.
  - Settings view renders.
  - Empty state text points Xavier to `npm run maxim:sync`.
- `go run . -path ..` launched the interactive TUI and timed out in the non-interactive shell. This is expected for a terminal UI event loop.

## Screenshots

No screenshot was captured in this shell because the dashboard is an interactive terminal UI, not a browser-rendered page. Automated render tests now cover the screen text paths. Manual screenshot capture can be done from VS Code terminal after launching the dashboard.

## Expected Manual Behavior

1. Native Career-Ops pipeline opens first.
2. Press `m` to open Maxim Apply mode.
3. Tabs are available for Today, High Conviction, Networking, Recruiter Inbox, Applications, Analytics, and Settings.
4. Press right/left, `l`/`h`, or tab navigation to move between views.
5. Press `m`, `q`, or `esc` to return to the Career-Ops dashboard.

## Live Snapshot Behavior

The current real Career-Ops tracker has one evaluated BLEN row. The live dashboard snapshot is no longer empty:

```json
{
  "todayActions": 0,
  "highConvictionJobs": 0,
  "networkingQueue": 0,
  "recruiterInbox": 0,
  "applications": 1
}
```

The BLEN role scored `3.9/5`, so it correctly does not appear in Today or High Conviction queues. The E2E fixture validation still proves populated T3 dashboard DTOs render.
