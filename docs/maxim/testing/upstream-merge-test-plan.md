# Upstream Merge Test Plan

Last updated: 2026-06-03

## Scope

This plan protects Maxim Apply from drifting too far from Career-Ops upstream.

## Patch Boundary Check

Allowed Maxim fork changes are limited to:

- `.gitignore`
- `AGENTS.md`
- `MAXIM_APPLY.md`
- `package.json`
- `docs/V2 Redesign/`
- `docs/maxim/`
- `data/maxim/`
- `maxim/`
- `dashboard/internal/maxim/`
- minimal dashboard hook files:
  - `dashboard/main.go`
  - `dashboard/internal/ui/screens/pipeline.go`

Run:

```powershell
npm run maxim:alignment
```

The alignment guard compares this branch against `upstream/main` when available and fails if changes appear outside the documented patch boundary.

## Native Smoke Checks

```powershell
node update-system.mjs check
npm run doctor
npm run verify
npm run maxim:test
npm run maxim:safety
npm run maxim:alignment
```

Dashboard checks after Go is installed:

```powershell
cd dashboard
go test ./...
```

## Merge Procedure

```powershell
git fetch upstream
git checkout maxim/v2-career-ops-fork
git merge upstream/main
npm run doctor
npm run verify
npm run maxim:test
npm run maxim:safety
npm run maxim:alignment
```

Resolve conflicts by preserving upstream Career-Ops behavior first and reapplying Maxim only inside documented extension zones.
