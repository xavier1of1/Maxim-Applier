# Coverage-Aware Discovery

S4 adds discovery to the existing Next/Astryx workspace and durable worker. Career-Ops
Greenhouse, Lever and Ashby mapping functions are retained, not replaced by a second
scanner. The native scanner remains independently usable before application cutover.

## Use

1. Run `npm run maxim:workspace` and open http://127.0.0.1:3010/maxim.
2. Sign in with the local workspace key (`npm run maxim:workspace:key`).
3. Open Discovery, Add source. Select Greenhouse, Lever or Ashby and enter the company's
   board slug. A manual HTTPS source is visible but explicitly unsupported for automation.
4. Select up to three enabled sources. Enter comma-separated role terms. Blank terms
   require current reviewed `preferences.roles`; current job title is not a default.
5. Search jobs. Inspect the run's coverage and source attempts before treating results
   as complete. Save/dismiss/restore openings; open the same stable job in Jobs.
6. Past searches retains query/source/policy revisions. Source health distinguishes
   never checked, disabled, stale, successful, empty, partial and failures.

No API account is required for these public boards. No LinkedIn, Indeed, Workday,
company-wide or destination-form support is implied. No application is filled or sent.
No production source or personal candidate data is activated automatically.

## Storage And Identity

Migration 005 stores source definitions, immutable query/source snapshots, durable runs,
attempts, requests, hashed page checkpoints, source aliases and raw job observations.
The existing job/application IDs remain the shared identity. Provider board/posting
identity or verified destination identity deduplicates observations; similar titles
do not merge distinct posting IDs. A reused identity with materially changed company
or title is flagged without overwriting the old role.

Raw public fields are preserved separately from HTML-to-text normalized descriptions.
Original posting, discovery provider and application destination remain distinct.
Posted time uses documented `first_published`/`publishedAt` only. Greenhouse
`updated_at` is source-update time, not posting time; first-seen/check times never
manufacture freshness. Missing dates are unknown. Saved/dismissed choices survive scans.

## Policy And Boundaries

Rust's isolated `job_policy` operation implements confirmed NoVA/DC, Maryland,
salary, clearance, freshness and priority-overlay rules. Gainesville/Manassas require
Virginia context; same-named out-of-state cities are not NoVA. Multi-location NoVA/DC
is accepted; unknown/remote/broad location is held for review. Missing or ambiguous
compensation stays unknown. Structured salary uses annual USD; full descriptions are
not greedily parsed as salary numbers. No fit score or tier is invented during discovery.
Only a retained Career-Ops evaluation may supply that score in S5.

Public GET transport permits only fixed provider hosts over HTTPS/443, validates all
DNS answers, pins the selected address and verifies the connected peer. Redirects,
private/reserved/metadata addresses, credentials, oversized/compression-expanded bodies,
invalid JSON/schema, access challenges and non-JSON responses fail explicitly.

Each run revision allows at most three sources, three pages/source, six network requests,
one executing worker lease and 90 seconds. Each request has an absolute 30-second deadline,
5 MiB compressed/decoded caps and 16 KiB headers. A shared per-host reservation paces
requests at least one second apart. Requests are recorded before HTTP, so a process
crash cannot reset the revision's budget. No hidden native retry can issue more HTTP.

Partial pagination and interrupted work retain eligible hashed pages for 15 minutes,
bound to run/source revision and original capture time. Manual retry requires enabled,
unchanged sources outside their cooldown. 429 numeric/date Retry-After is honored with
a minimum 60 seconds and a conservative one-year upper bound; no automatic source retry.
Cancellation invalidates publication immediately; lease renewal aborts in-flight work
within ten seconds, and no next request passes the authorization fence.

The dashboard refreshes only while an active search is visible/online, at most 45
sequential two-second checks per mounted run view. It never starts another provider
scan. Refresh remains available after the bound.

Failures remain visible with manual fallback responsibility. Previously observed jobs
are retained, not erased by a failure or misrepresented as newly checked. Source health
becomes stale after 24 hours; the UI labels bounded recent read windows explicitly.

## Agent And Commands

`GET /api/discovery` and `POST /api/discovery/commands` share authenticated
workspace/CSRF/revision/idempotency rules with the dashboard. Commands:
`add_source`, `set_source_enabled`, `start_search`, `cancel_search`,
`retry_search` and `set_discovery_state`.

Agent `read_discovery` returns an explicitly bounded summary and IDs. A current
user quote containing search/find and the actual role terms is required to start a
bounded search. Save/dismiss/restore needs an exact quoted action and job UUID.
The model cannot approve candidate facts, answer reuse, packets or submissions.

## Verify

- `npm --prefix maxim/app test`: real disposable PostgreSQL/workers, unit/Rust,
  production build and desktop/mobile Chromium.
- `node --test maxim/tests/unit/source-readiness.test.mjs maxim/tests/unit/scan-cli-safety.test.mjs`:
  native audit/help read-only regressions.
- From `maxim/app`, using pinned Node: `node scripts/smoke-discovery.mjs --live duolingo`.
  This explicitly performs one bounded public feed request through a disposable workspace.
  Without `--live` it refuses. No accounts, production records or applications are touched.

See `roadmap/reviews/s4-discovery.md` for dated evidence and measured scope.
