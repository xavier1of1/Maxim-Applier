# Compact Archive And Capacity

## Intent
Protect evidence while bounding live leads and bulky payloads.

## Contract
Preview first. Capture compact telemetry before removing details. Protect pins, notes, applications/packets, references and active work. Preserve original identities; restore does not reapprove old packets.

See the [roadmap](../README.md) for defaults, interfaces and authority. Extend only
the existing service boundaries; preserve Career-Ops and approved data contracts.

## Acceptance And Handoff
Implemented owner-previewed compaction (50 records / 20 old runs per batch),
an opt-in daily sweep, protected-note/save/reference/application exclusions and
active-work fencing. Stable opening stubs prevent automatic rehydration. Compact
history is paginated and restorable; restored descriptions/scores require fresh
evidence. Manual creation and scanner ingestion respect the saved capacity policy.
Submitted application history is protected outside the lead limit.

Evidence: production build and isolated retention integration passed, including
save-after-preview invalidation, cross-workspace isolation, compact qualifications,
identity-preserving restore and active-work hold. No production cleanup was run.

Prove cap backpressure, protected survival, actual payload reduction, idempotent cleanup, exact history and restore/dedupe.

Commit each stage after checks. Update standing from actual evidence, not planned
tests or an account integration that remains disabled.

> **Comments**
> Add stage-specific feedback and findings here.
