# Bounded Orchestration

## Intent
Reuse durable leases and queue helpers for timed scanning and scoring.

## Contract
Skip missed ticks. Lock reservations. Snapshot settings/model/candidate identity. Recheck grants at transport; one automatic billable attempt; preserve uncertain reservations.

See the [roadmap](../README.md) for defaults, interfaces and authority. Extend only
the existing service boundaries; preserve Career-Ops and approved data contracts.

## Acceptance And Handoff
Implemented the existing-worker minute tick, narrow queue helpers, persisted owner
policy grants, per-source rotating intake quotas, serial automatic requests and
conservative daily request/token/cost reservations. Automatic attempts cannot
redispatch after entering sending. Expired interrupted sends become uncertain;
pre-dispatch failures release their reservation. Pause fences publication, but an
already dispatched request may still be charged. Manual evaluation remains an
explicit, separate action outside the automatic allowance.

Evidence: production build passed; `intelligence.test.mjs` passed in an isolated
PostgreSQL/provider fixture, including a two-request daily limit, saved-policy
revision conflicts, pause, owner-only changes and chat proposal approval.
Real provider billing and production scheduling were not enabled.

Integration proof: restart, replay, races, budget/size limits, paused/revoked grants and explicit failure.

Commit each stage after checks. Update standing from actual evidence, not planned
tests or an account integration that remains disabled.

> **Comments**
> Add stage-specific feedback and findings here.
