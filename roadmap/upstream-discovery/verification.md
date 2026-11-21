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

Stage 2: production Next.js/Rust build and strict TypeScript passed. Isolated
`upstream-discovery.test.mjs` passed, proving a board-wide result creates an
opening for an unregistered employer, preserves its full description, deduplicates
repeated retrieval, isolates another workspace and records a challenge as failure.
Source-pack creation is idempotent. Raw feed bodies are not retained.

Stage 3: five bridge unit tests passed, including actual extracted upstream
inventory normalization for eight tenant directories and the ninth Workable feed
contract. Extended isolated integration passed: a five-tenant directory scans a
four-tenant window, reports partial coverage, then reaches the fifth employer on
the next run without downloading the directory again. Cursor updates commit only
against current authorization. Workable's large feed stays explicitly deferred.

Stage 4: 46 Rust tests passed, including six new responsibility/title cases;
two TypeScript-to-Rust profile tests passed. Production build and the expanded
isolated integration passed. Current evidence-backed owner profile rescues an
unexpected title and keeps active-clearance requirements blocked. Profile changes
are revision checked and stale runs cannot publish against changed knowledge.

Stage 5: 48 Rust tests and three detail-acquisition unit tests passed. Expanded
isolated integration exercises a broad-board teaser, verified JSON-LD details,
responsibility rescue and real retained evaluator execution against the fixture
model. Summary records cannot enter paid scoring. A local revalidation command
checks artifact hashes/current inputs and makes zero provider requests.

Discovered live scoring defect: eight held reports had matching numeric scores,
but Markdown bold/provisional suffixes were incorrectly parsed as conflicts.
Rust now accepts those display formats while still rejecting genuine disagreement
or ambiguous numbers. Stored reports can be repaired without purchasing another
evaluation; live repairs and final counts remain to be recorded below.

## Remaining Setup And Limitations

Local approved candidate evidence, an accessible configured evaluation model,
and explicit scoring-budget authorization are necessary for real evaluations.
The owner has specified a maximum of $5/day. Provider access failures must be
reported, not bypassed. Remote work remains subject to reviewed geography.
