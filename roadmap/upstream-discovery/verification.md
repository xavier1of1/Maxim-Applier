# Discovery Execution And Verification

Started 2026-11-21. Status: implementation in progress.

## Baseline

The dashboard executed only Greenhouse, Lever and Ashby employer feeds. The
retained upstream version is 1.8.1; the approved discovery-only adoption is
Career-Ops 1.40.0 at `194933aa111aa4f2fd3ffa69048347fa6a974d27`.
Prior live inventory: 481 openings across eight employers; no claim that those
records have current fit evaluations. Refresh live totals before final reporting.

## Evidence

Stage 1: `node --import tsx --test tests/unit/upstream-bridge.test.mjs` passed
4/4 tests. All 153 providers and 195 source files pass SHA-256 verification.
Imported upstream source is 2,606,123 bytes. Permission-boundary probes deny
file writes, private reads and subprocess execution; inherited secret is absent.
Real Greenhouse provider parsing is exercised with an injected full-posting feed.
These are fixtures, not a 153-provider live certification. No paid evaluation yet.

## Remaining Setup And Limitations

Local approved candidate evidence, an accessible configured evaluation model,
and explicit scoring-budget authorization are necessary for real evaluations.
The owner has specified a maximum of $5/day. Provider access failures must be
reported, not bypassed. Remote work remains subject to reviewed geography.
