# Discovery Execution And Verification

Started 2026-11-21. Status: six stages implemented and verified within the explicit
source/access/resource limits below. This is not a complete internet sweep or a
guarantee that every saved role is appropriate or currently open.

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

## Final Technical Acceptance

| Check | Executed result |
| --- | --- |
| Production Next.js / TypeScript / Rust build | Passed repeatedly; final corrected build deployed locally |
| Rust domain tests | 52 passed, including level parsing, local-first priority, all-scanned coverage and unchanged score bands |
| App units | 78 passed, including exact public GraphQL, permissions, expiry, professional-only projection and provider windows |
| Full backend integration | 145 passed on each of two complete runs before the subsequent fit audit |
| Full Chromium acceptance | 43 passed on complete desktop/mobile runs |
| Post-audit targeted backend | Consent/onboarding/discovery/intelligence run: 14 passed; broader intelligence paths: 11 passed; final source/intelligence run: 12 passed; final local-window/source regression: 5 passed. These overlap and must not be summed as distinct cases. |
| Post-audit desktop/mobile | 10 discovery, profile-level, scoring/filter and settings journeys passed |
| Retained Maxim extension suite | 70 passed |
| Native Career-Ops baseline | 146 checks passed, zero failures, one sanitized-fixture CV warning |
| Native Go dashboard | `go test ./...` passed |
| Platform safety | Passed; all pinned hashes checked; 11 narrowly hash-bound false-positive reviews documented |
| Privacy | Passed; no findings in 835 publishable/unignored files after documentation updates |
| Roadmap contracts | Validator passed and 17 validator unit tests passed; original annotated workflow unchanged |

The native baseline's Windows path subchecks are not a substitute for the separate
privacy scanner. Fixture models prove contracts, not candidate fit. Desktop and
390px screenshots were inspected; browser tests check overflow and real empty,
partial, error and review states. The same-context EGM-style drift check is not an
independent Goldfish review.

## Local Data And Authority

- The owner requested removal of 150 arbitrary jobs and capacity 600. Exactly 150
  original unprotected, unscored records were archived. Zero hard deletes.
- The first broad probe retained 78 records before the conservative location fix.
  66 unprotected rollout-created uncertain/global records were separately archived
  as a correction; no additional original jobs were affected.
- Before the experience correction, 358 active records remained across 25 employers,
  including 27 new active market records, compared with the original eight-employer
  inventory. The revised DC Built In run subsequently added 31 bounded summaries.
- Schema 016-018 is applied. Backups were taken before migration and disclosure
  changes, with credentials excluded. Candidate ownership stays canonical;
  application ownership remains legacy. No silent application cutover occurred.
- The owner explicitly approved model disclosure of roles and experience levels
  only. Two isolated declarations preserve the original shared personal source's
  local-only consent. Candidate revision changed from 61 to 63; old scores became
  historical rather than being relabeled current.

## Measured Search Results

These are bounded source runs, not unique totals to sum across overlapping reruns.

| Actual probe | Measured result | Limitation |
| --- | --- | --- |
| Initial four-board run | 429 returned, 74 initially admitted, 53 employers, 18 requests, approximately 3 MB | Initial global/summary defects were corrected; not all were valid local leads |
| Corrected Wellfound run | 68 returned, 21 retained across 18 employers, two requests, full native bodies | Two-page cap; no exhaustive-board claim |
| Experience-aware Wellfound rerun | 12 retained across ten employers; 14 explicit seniority mismatches held | Previous senior records are not silently deleted |
| DC / junior / Engineer II Built In run | 109 returned, 31 new local-compatible summaries across 24 employers, ten requests; 36 explicit seniority mismatches held | Bodies require verified details; local detail priority was subsequently corrected |
| a16z DC/function/seven-day run | 15 returned; bounded identity-checked detail calls; Northwood full body and actual ATS destination verified | Some changed/closed identities held; four detail reads per source by default |
| Experience-aware a16z rerun | Four explicit seniority mismatches held | No role suitability inferred just from a source label |
| Reverse ATS | All eight bounded directory paths exercised; persisted inventories/cursors advance | Many dead or irrelevant tenants, small four-tenant samples, partial coverage |
| join.com after correction | 13 jobs returned from four tenants, 11 requests, zero failed tenants | Foreign results held; ten thousand-plus tenants remain uninspected |
| Workday | Public discovery attempted and access/quota failure recorded | Recorded cooldown retained; no challenge bypass or artificial reset |
| Workable | Contract retained, source disabled | Large global compressed feed explicitly deferred |

One concrete Built In junior result reported a publisher expiry of 2026-11-14.
It was correctly not promoted to verified current full evidence on November 21.
Expiry now has an explicit `posting_expired` hold. A long description, fresh-looking
list card or matching title does not establish a live eligible application.

Provider result windows rotate after the first 500 records. Reverse directories
are compact and cached for 24 hours. Unknown remote titles cannot exhaust the
detail quota before known local candidates; remaining quota may explore uncertainty.
No raw HTML/feed copy, browser profile, private CV or provider credential is
retained by or supplied to the provider subprocess.

## Real Scoring And Fit Outcome

Eight matching-score reports held only because of Markdown formatting were
revalidated locally with zero new model requests. The first paid profile reached
55 current active scores with a $1.82 automatic-ledger checkpoint, 797,234 settled
tokens and 57 daily reservations. The next maximum-sized reservation did not fit
the original one-million-token ceiling, so execution stopped instead of raising it.

The [fit audit](fit-audit.md) found 176/358 senior/management titles, unused approved
level preferences, model-withheld target context and a rotating-global-window gap.
With explicit owner approval, only roles/levels became model-disclosable and the
token ceiling increased to two million. The $5/day and 100-evaluation caps stayed.
Candidate revision changes correctly invalidated the old ranking.

A real current Kaizen Labs Software Engineer evaluation is now 4.0/T2, compared
with 3.8/T1 before the target-context correction. Alarm.com Software Engineer II
re-evaluated at 3.8/T1. Neither stored number nor Career-Ops threshold was edited.
This does not certify a live opening, compensation, every requirement or an
interview. Other roles genuinely remain low-fit, uncertain, expired or unscored.

At 2026-11-22T00:02:54Z, capacity was 389/600, 12 active scores were current and
three validations were pending. The ledger showed $2.95 including outstanding
conservative reservations, not necessarily settled provider charges. Later
scheduled work remains governed by the same approved limits; read Settings for
live totals. No claim is made that all 605 stored/historical records were scored.

Final checkpoint at 2026-11-22T00:07:56Z: 19 current evaluations, zero pending,
76 daily reservations, 1,057,756 settled tokens and $2.42 in the automatic ledger.
The local top three were Thea Software Engineer 4.1/T2, Kaizen Labs Software
Engineer 4.0/T2 and Anduril 2027 Early Career Systems Engineer 4.0/T2. Capacity
remained 389/600. The final local-first detail sweep recovered four verified full
bodies among 31 retained Built In matches; the remaining 27 stayed summaries.
Paid schedules remain owner-approved and can advance after this checkpoint.

## Operate And Recover

Use [the guide](../../docs/maxim/upstream-discovery.md) and
[Jobs, local and highest score first](http://127.0.0.1:3010/maxim?view=jobs&sort=score_desc&locationGroup=local).
The stack runs on port 3010. Public packs need no additional API account.
Missing model/disclosure/owner consent is a real setup gate, not a fake success.
Access limitations, expired JDs and Workable are not solved by credentials,
unbounded sweeps or anti-bot tooling. Preserve unknowns and review the actual report.
