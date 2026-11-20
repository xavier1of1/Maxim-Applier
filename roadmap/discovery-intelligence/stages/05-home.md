# Home And Final Proof

## Intent
Ship honest Sankey, up to five recommended lanes, eight stats and real README.

## Contract
Use d3-sankey for layout. Unique confirmed submission cohorts, recorded stages and explicit unknown paths. Recommendations need current T2+ unsubmitted jobs. No mock metrics or fabricated stages.

## Inputs And Outputs
Depends on Stages 1-4 and existing canonical application actions/evaluations.
`GET /api/home` returns a timezone-bound metric set, aggregate flow and up to five
actual high-fit lanes. The browser uses pinned BSD-licensed d3-sankey 0.12.3 for
layout; Rust constructs/conserves recorded flow counts.

Known posting URLs/identities are deduplicated across reviewed reapplications;
unknown identities stay separate. Use the latest submission's outcome and combined
recorded cohort stages. Per-record submission/correction resets earlier evidence.
Never infer a response/interview/task/final round merely from a later status.

## Home Journey
Home is the default authenticated view. Setup gaps link to actual Candidate,
Settings and Discovery surfaces. Eight metrics maximum: today/week submissions,
seven-day unique scan observations, fresh current high fit, awaiting response,
interview/offer evidence and automatic cost/reservations. Day/week use policy
timezone and Monday week start; cohorts are rolling 30/90/365 days.

Recommendations require current T2+, compatible location, no blocker, a fresh
posting and recent observation. Fewer than five supported lanes means fewer
recommendations. Opening a lane clears conflicting old filters. Current score
does not prove posting liveness. Latest-request fencing prevents cohort races.

## Proof And Documentation
Unit/pure tests cover conservation, no invented stages, empty state and Unicode
bounds. Isolated PostgreSQL/provider cases cover corrections, identity dedupe,
stale evidence removal, reservation/lease/day checks, no repeated uncertain sends,
source/pool starvation, raw-policy retention and restore/rearchive preservation.
Chromium covers desktop/mobile graph, eight-stat limit, filter navigation and
out-of-order requests. Inspect screenshots, not just DOM counts.

Update the root README with shipped architecture/journey/budget/retention diagrams,
the detailed operating contract, implementation status and measured verification.
Run retained/native, Go, safety, privacy and roadmap checks. Only then commit this
stage and publish the roadmap branch. Do not claim production billing, automatic
cleanup, live integration access or original MVP gates were approved by fixtures.

Recovery: pause automation, retain ledger/history/private backups and roll back
the app build if needed. Do not drop extension tables or reverse canonical entity
ownership merely to undo a UI feature.

See the [roadmap](../README.md) for defaults, interfaces and authority. Extend only
the existing service boundaries; preserve Career-Ops and approved data contracts.

## Acceptance And Handoff
Run Rust/unit/integration/Chromium/native/build/privacy/safety/roadmap checks; inspect screenshots; record manual enablement and remaining gates.

Commit each stage after checks. Update standing from actual evidence, not planned
tests or an account integration that remains disabled.

> **Comments**
> Add stage-specific feedback and findings here.
