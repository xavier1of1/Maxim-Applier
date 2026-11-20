# Bounded Orchestration

## Intent
Reuse durable leases and queue helpers for timed scanning and scoring.

## Contract
Skip missed ticks. Lock reservations. Snapshot settings/model/candidate identity. Recheck grants at transport; one automatic billable attempt; preserve uncertain reservations.

See the [roadmap](../README.md) for defaults, interfaces and authority. Extend only
the existing service boundaries; preserve Career-Ops and approved data contracts.

## Acceptance And Handoff
Integration proof: restart, replay, races, budget/size limits, paused/revoked grants and explicit failure.

Commit each stage after checks. Update standing from actual evidence, not planned
tests or an account integration that remains disabled.

> **Comments**
> Add stage-specific feedback and findings here.
