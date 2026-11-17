# S4 Discovery Acceptance

Verification date: 2026-11-17. Built on S3 commit 232a0ab.
Final full verification passed: 23 Rust tests, 12 unit tests, 50 integration TAP cases
(including suite parents), and 12 Chromium workflows. TypeScript/production build pass.
No personal records, candidate approvals or application actions are part of these tests.

## Executed Checks

- Production Next/Astryx build and TypeScript checks.
- Rust policy/tier/fact/question tests; source extraction, Microsoft tokenizer and bounded-network unit tests.
- Disposable PostgreSQL, real worker and captured provider/model service integration.
- Production Chromium desktop 1600x1000 and mobile 390x1000 discovery flows, plus S1-S3 regressions.
- Native offline source audit/help and scanner CLI safety: four cases pass.
- Retained Go dashboard `go test ./...` passes.
- `npm run maxim:safety` passes after replacing the unbounded dashboard interval
  with a finite foreground/online-only refresh loop. Provider network limits are separate.

Environment: Windows, pinned Node 24.22.3, Rust 1.76 MSVC, PostgreSQL 18.1 disposable
Docker, production Next 16.4.6/React 19.3.1/Astryx 0.7.16, Playwright Chromium.
Fixtures use no real credentials. All provider HTTP is recorded and lacks auth/cookies.

## Case Evidence

| Case | Actual proof |
| --- | --- |
| DSC-01 | Offline audit help runs without source/candidate files; disabled/explicit/unmatched configuration remains distinct; scan help/unknown arguments never scan |
| DSC-02 | Repeated provider IDs retain three distinct openings; Ashby-to-Greenhouse destination alias shares the correct ID; material identity changes are observed without overwriting the prior job |
| DSC-03 | Query terms/filter/source/candidate revisions, hashed pages and raw observations persist; unknown Greenhouse posting date stays null despite known update/check dates; Ashby publishedAt remains distinct |
| DSC-04 | Actual loopback empty-success, quota/cooldown, access challenge, HTTP failure, redirect, schema drift, partial pages, unsupported manual source and stale source health are distinct |
| DSC-05 | Successful first page is reused on explicit retry; quota cooldown prevents immediate retry; cancellation fences late publication; actual killed process reclaims its lease/page and persists the interrupted request without resetting budget; native pipeline/history hashes stay unchanged |
| DSC-06 | Unit fixtures reject private/metadata/reserved/mapped addresses, mixed DNS, peer change, unsafe schemes/credentials/hosts, redirects, oversized/compressed bodies and absolute deadline violations |
| DSC-07 | Rust and integrated policy fixtures prove NoVA/DC, Gainesville/Manassas VA, excluded MD with reasoned manual override, multi-location acceptance and out-of-state same-name blockers; salary/clearance/freshness/connection boundaries stay separate from fit |
| DSC-08 | Production UI search/history/save/dismiss/restore and source health share canonical IDs; exact-current-request agent search/save/dismiss uses the same command service, refuses invented instructions, and returns bounded labeled summaries; dated public smoke below is separate from fixtures |

## Public Smoke

Executed `maxim/app/scripts/smoke-discovery.mjs --live duolingo` through a disposable
workspace, real durable worker and hardened public transport:

- Request: `https://boards-api.greenhouse.io/v1/boards/duolingo/jobs?content=true`.
- Request started 2026-11-17T19:19:54.508Z; HTTP 200, 710,578 decoded bytes.
- Captured 2026-11-17T19:19:54.654Z; 59 source records in one page.
- Page SHA-256 `fc3286a2aa5cda9df25d04ac6af91a06c42b48e93df8876f3e9bca88edaec112`.
- Query `engineer`: 43 matches/new openings, one request, one successful source,
  no failed/partial source or identity conflict; completed 19:20:36.790Z.
- Actual transport flag `fixture_transport=false`. No auth, account, browser action,
  personal tracker write or production import. The disposable DB was removed afterward.

This proves that one board's feed worked at this time, not ongoing source availability,
NoVA/DC fit, live model quality, all configured companies or application-form support.

## Review And Deliberate Limits

Desktop/mobile screenshots were visually inspected: readable navigation and operational
states, no horizontal overflow/control overlap or page errors. Long lineage is contained
in a scrollable details region; jobs remain accessible below it.

Failures found during implementation included fixture default-404 configuration,
build-time native-module tracing, an oversized agent summary and a token-split test
assertion. These were corrected, not classified as passing results. Request accounting
was moved before HTTP so a real process crash cannot reset the per-revision budget.
Unapproved role-category assumptions were removed during policy authority review.

Native provider mapping is retained; discovery never imports the side-effectful scan
CLI. Public provider documentation was checked against the adapter boundaries:
[Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html),
[Lever Postings API](https://github.com/lever/postings-api),
[Ashby Public Job Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api).

Broad JSearch/Adzuna/FreeHire subscription comparison is optional and not activated.
No first-party LinkedIn/Indeed connector, general web search, CAPTCHA workarounds,
hidden automation or application executor was introduced. Candidate authority is not
implicitly activated by a search. S5 evaluation/application ownership remains separate.

Same-context EGM drift/implementation review only, not independent Goldfish convergence.
