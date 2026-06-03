# Maxim Dashboard Smoke Test

Last updated: 2026-06-03

Automated Go package tests compile the dashboard model and service packages. The Bubble Tea TUI itself still needs a short manual smoke test because it is interactive.

## Automated Compile Test

```powershell
cd "d:\VSC Programs\maxim-apply"
npm run maxim:dashboard-state
cd dashboard
gofmt -l internal\maxim\model.go internal\maxim\service\service.go
go test ./...
```

Expected result:

- `gofmt -l` prints no Maxim-owned Go files.
- `go test ./...` passes.

## Manual TUI Smoke Test

```powershell
cd "d:\VSC Programs\maxim-apply"
npm run maxim:dashboard-state
cd dashboard
go run . -path ..
```

Expected result:

1. Native Career-Ops pipeline opens.
2. Press `m`; Maxim Apply mode opens.
3. The header says `Maxim Apply`.
4. Use left/right or tab-style navigation to inspect Today, High Conviction, Networking, Recruiter Inbox, Applications, Analytics, and Settings.
5. Empty states are readable when no real data exists.
6. Press `m`, `q`, or `esc`; control returns to native Career-Ops.

## Notes

In a non-interactive shell, `go run . -path ..` may not exit by itself because it launches the TUI event loop. That is expected; use this command in an interactive terminal for the manual smoke test.
