# Bounded Orchestration

## Intent
Reuse durable leases and queue helpers for timed scanning and scoring.

## Contract
Skip missed ticks. Lock reservations. Snapshot settings/model/candidate identity. Recheck grants at transport; one automatic billable attempt; preserve uncertain reservations.

## Inputs And Execution
Depends on Stage 1 and the existing durable worker, not a new scheduling service.
The minute tick reads persisted due times, coalesces missed work and queues one
workspace cycle. Scan completion makes scoring due. A cycle rotates a bounded
source batch, records selections/holds and queues the retained evaluator.

Per-source record offsets survive source rotation; the same feed prefix must not
be the only discoverable subset. For lead capacities above 200, screening windows
wrap/rotate instead of permanently excluding rows after the first 200. Posting-
specific validation failures become revision-bound automatic holds, while safe
later selections continue. Global authorization/configuration/budget failures stop.

## Financial And Authority Boundary
The owner grants settings/model/candidate-scoped authority. Narrow queue helpers
reuse existing validation without impersonating a logged-in browser session.
Reserve requests/tokens/cost atomically before dispatch. Complete local model/
context validation before recording sending. Recheck wall-clock lease/day and
grant identity immediately before transport; serialize automatic billable leases
in PostgreSQL. Automatic attempts have no hidden retransmission after uncertainty.

```mermaid
sequenceDiagram
 Timer->>DB: Read due policy and claim one cycle
 Cycle->>Rust: Screen one bounded rotating window
 Cycle->>DB: Reserve allowance and queue exact evaluation
 Evaluator->>Evaluator: Validate complete local request
 Evaluator->>DB: Recheck live grant/day/lease; record sending
 Evaluator->>Provider: One request
 Provider-->>DB: Settle known usage or retain uncertainty
```

## Failure And Recovery
Pause/revision changes fence pending dispatch/publication. A dispatched request
may still be charged. Crashed sends become uncertain; unsent preflight failures
release their allowance. Explicit manual retry remains outside the automatic
budget. No live automatic spending is enabled by deployment or fixture tests.

Stage 5 adds migration 015 and regression proof for per-job holds/source cursors
after the independent implementation drift review.

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
