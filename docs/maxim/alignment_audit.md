# Maxim Apply Alignment Audit

Last updated: 2026-06-03

## Authority Checked

- Latest user instruction: continue in the Career-Ops fork; public repository visibility is acceptable.
- `docs/V2 Redesign/maxim_apply_career_ops_redesign_v2_1.md`
- `docs/V2 Redesign/maxim_apply_career_ops_implementation_roadmap_v1_1.md`
- Career-Ops upstream behavior and data contract.
- Maxim ADRs and `AGENTS.md` fork addendum.

## Alignment Summary

| Area | Status | Notes |
|---|---|---|
| Career-Ops fork strategy | Aligned | Maxim is implemented inside the Career-Ops fork, not as a separate CRM. |
| Upstream preservation | Aligned | Core scoring, PDF generation, scanning, tracker scripts, modes, and apply assistant are not rewritten. |
| Patch boundaries | Aligned | Changes are limited to Maxim-owned paths, docs, package scripts, `.gitignore`, and the small dashboard hook. |
| Career-Ops score authority | Aligned | Maxim tiers are derived only from Career-Ops 1.0-5.0 score. |
| Xavier policy rules | Aligned | NoVA/DC, Maryland exclusion, Gainesville/Manassas inclusion, salary, clearance, expected salary, and manual LinkedIn rules are covered by config/policy tests. |
| Local-first storage | Aligned | Maxim state lives in ignored local SQLite/JSONL/import paths under `data/maxim/`. |
| Raw data preservation | Aligned | Historical imports copy raw files before normalization and keep normalized output separate. |
| Networking workflow | Aligned | Discover/rank/research/draft/manual statuses exist; no message sending path exists. |
| Recruiter workflow | Aligned | Manual recruiter thread create/respond/correct flows exist, and Needs Response clears when responded. |
| Notifications | Aligned | Dry-run works without secrets; live Discord requires env var; duplicate suppression exists. |
| Analytics | Partially aligned | Empty/small data works and NoVA/DC KPI exists. Deeper breakdowns depend on real outcome data. |
| Application tracking | Aligned for v1 | Packet/manual status tracking exists; no automated submission path exists. |
| Dashboard integration | Aligned for MVP | Native dashboard has a Maxim mode hook, `DashboardService` DTO seam, Today, High Conviction, Networking, Recruiter, Applications, Analytics, Settings, and optional store-backed DTOs via `npm run maxim:dashboard-state`. |
| Release hardening docs | Aligned | Setup guide, release notes, known limitations, dashboard test plan, and upstream merge test plan are present and enforced by `maxim:alignment`. |
| Go dashboard tests | Blocked locally | Go/gofmt are not installed on this machine. |

## Runnable Alignment Guard

Run:

```powershell
npm run maxim:alignment
```

The guard checks:

- required authority docs and extension files,
- required npm scripts,
- required SQLite tables,
- user-layer files remain untracked,
- fork changes remain inside documented patch boundaries,
- platform safety scanner passes.

The guard should pass without issues. Go dashboard compilation still depends on local Go/gofmt availability.

## Verification Commands

Run these before treating the fork as ready:

```powershell
npm run maxim:alignment
npm run maxim:test
npm run maxim:safety
npm run maxim:doctor
npm run doctor
npm run verify
npm run maxim:sync
npm run maxim:analytics
npm run maxim:notify
npm run maxim:dashboard-state
```

Dashboard verification remains:

```powershell
cd dashboard
go test ./...
```

This requires Go/gofmt locally.
