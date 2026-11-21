# Upstream-Native Discovery Roadmap

Approved direction: [design](../upstream-discovery-design.md). Started 2026-11-21.
This roadmap extends the existing workspace, worker and Career-Ops evaluator.
It does not replace candidate/application authority, scoring, PDFs or manual submission.

## Outcomes

Discover employers outside the watchlist; retain relevant unconventional titles;
acquire actual descriptions; rank using current Career-Ops evaluations; expose
honest source coverage and remain within the owner's $5/day scoring allowance.

```mermaid
flowchart LR
 P[Reviewed search profile] --> S[Existing scheduler]
 S --> U[Pinned upstream providers]
 S --> R[Reverse ATS inventories]
 U --> N[Normalized postings]
 R --> N
 N --> D[Bounded detail acquisition]
 D --> G[Policy and responsibility gates]
 G --> DB[(Existing PostgreSQL)]
 DB --> E[Budgeted Career-Ops evaluation]
 E --> J[Jobs sorted by current score]
```

## Stages

| Stage | Implementation and handoff | Acceptance evidence | Status |
| --- | --- | --- | --- |
| 1. Pinned engine | Vendor all 153 provider modules and necessary dependencies with source hashes/license; classify capabilities, direct-network and executable-parser restrictions. Read-only subprocess/result protocol, sanitized environment and bounded transport. | Four bridge tests passed; 153 providers, 195 pinned files, 2,606,123 bytes. Native public-peer validation reused in Stage 2. | Complete |
| 2. Board-wide execution | Integrated upstream providers with existing sources/runs/attempts, worker and store; US technology and optional remote source packs; compact provenance and public read transport. | Production build/typecheck and isolated board-wide integration passed: unknown employer, idempotence, workspace isolation, full JD, no secret headers, challenge/cooldown. UI follows in Stage 6. | Complete |
| 3. Reverse ATS | Reuse pinned upstream public inventory definitions/parsing for all nine ATS families; persist inventory age, rotating cursors and bounded tenant scans. Workable's large global feed is an explicit resource-heavy option, never an unbounded default. | Rotation, unavailable inventory, capped/partial result and duplicate tests; live bounded probe. | Pending |
| 4. Search profile | Versioned reviewed public criteria, work families, title aliases and responsibility groups. Inspect available descriptions before title rejection; bounded detail exploration for title misses. Rust owns pure screening/eligibility where practical. | Unexpected title retained on work evidence; exclusions and clearance hold preserved; remote does not bypass geography; no candidate facts invented. | Pending |
| 5. Description and scoring | Explicit description completeness, bounded safe enrichment, existing evaluator/consent/budget ledger. Preserve all-scanned option, unknown/unavailable states and source provenance. | Summary cannot masquerade as full JD; provider failure holds cleanly; budget and current-score integration tests; actual live evaluations. | Pending |
| 6. Experience and proof | Compact discovery/profile/catalog/coverage controls; agent reads/proposes through existing approval boundaries. Document exact live results, failures, storage and scoring yield. | Desktop/mobile UI, full practical regression suite, native compatibility and privacy/safety checks. | Pending |

Each stage is a scoped commit. Stage boundaries may share interfaces; a stage is
not complete merely because a fixture or a populated catalog exists.

## Constraints And Decisions

- Pin `194933aa111aa4f2fd3ffa69048347fa6a974d27`; no wholesale upstream merge.
- Retain all 153 implementations, but do not activate restricted/retired/local-exec
  or unreviewed transports. Installed, enabled, tested and successful are separate.
- Reuse upstream provider parsing, not lossy scan receipt output or native writers.
- No private candidate context or API/database secrets in discovery subprocesses.
- Public read-only search POSTs are permitted only where the audited provider
  requires them. Never allow arbitrary browser actions or application submission.
- No source/profile change authorizes paid evaluation, cleanup or remote eligibility.
- Use existing 200-lead capacity/protected history rules. Do not silently delete
  the owner's existing over-capacity backlog to make a demonstration pass.
- Report partial coverage and skipped/uninspected records. No exhaustive-web claim.

## Verification Matrix

| Issue | Required proof |
| --- | --- |
| Employer-watchlist dependency | Board-wide and reverse fixtures admit a new employer without adding a company source. |
| Titles miss real work | A non-alias title with integration/automation responsibilities reaches evaluation; title-only similarity is not a fit score. |
| Incomplete job evidence | Teasers remain summaries until an authorized detail endpoint supplies the full JD. |
| Narrow/invisible coverage | UI/API distinguish provider catalog, enabled sources, actual requests, unique employers, failures and caps. |
| Duplicate publishers | Canonical ATS identity/URL aliases converge without fuzzy merging distinct job IDs. |
| Uncontrolled cost/storage | Budget reservations remain atomic; bytes/requests/deadlines/retention/capacity remain bounded. |
| Misleading ranking | Current Career-Ops scores sort first; stale, missing or failed scores remain explicit. |
| Unsafe regression | Native commands, tracker projections, PDF and manual-submit boundaries still pass. |

## Execution Record

Implementation and live/test results will be recorded in [verification](verification.md).
External availability, source rights, credentials and owner approvals are not
simulated. Unavailable providers remain visible with the exact reason.
