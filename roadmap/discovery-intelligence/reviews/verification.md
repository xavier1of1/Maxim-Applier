# Discovery Intelligence Verification

Date: 2026-11-20. Canonical repository: `D:\VSC Programs\maxim-apply`.
Branch: `maxim/discovery-intelligence`. This record covers the new roadmap, not
approval of unrelated outstanding live-account gates from the original MVP.

## Publication And Stage Receipts

| Stage | Commit / evidence |
| --- | --- |
| Baseline | `2c7031e` committed existing score work, pushed and fast-forwarded origin/main |
| 0 Plan | `2527e5a` created roadmap and recorded the new branch |
| 1 Policy | `09c4b41` strict defaults and Rust shortlist/metadata |
| 2 Orchestration | `b8f1152` durable cycles, grants and allowances |
| 3 Retention | `50c1249` compact history, capacity, preview and restore |
| 4 Workspace | `e95c837` SQL filters, settings, archive and agent proposals |
| 5 Home / hardening | Final Home/hardening stage commit in repository history; acceptance passed |

## Checks

| Check | Measured standing |
| --- | --- |
| Production build / strict TypeScript | Passed |
| Rust | 38 tests passed |
| App units | 52 tests passed |
| Complete isolated PostgreSQL/provider integration | 143 passed, 0 failed in the final sequential run |
| Complete Chromium journeys | 37 passed, 0 failed in 5.3 minutes; desktop and mobile |
| Targeted new Home / settings / retention Chromium | 6 passed at desktop/mobile plus cohort-race and lane-navigation paths |
| Legacy Maxim suite | 70 passed |
| Sanitized Career-Ops/native proof | 146 passed, 0 failures, expected missing-user-CV warning |
| Go dashboard | `go test ./...` passed |
| Safety / privacy | Passed; rechecked before publication |
| Original roadmap validator / unit suite | Passed; 17 validator tests |
| New roadmap / guide local links | 11 documents, 48 local links, none broken |
| Post-test storage audit | No remaining fixture directories or owned Docker test records |

Earlier red runs exposed a malformed UUID/text fixture, a Docker port-probe race,
fixture coupling and local-preflight test data that stopped at the earlier policy
boundary. Those were repaired, not counted as successful acceptance. The harness
uses bounded port-collision retry with fixed mappings so database restart/restore
remains testable; it never stops another project's container or uses global prune.
Two old model-settings browser cases also needed their account-model combobox
locator scoped after the new settings selector was added. Both passed in the full
37-case rerun; no product assertions were removed. Native Windows shell path/leak
probes emitted platform diagnostics, so they are not treated as strong privacy
proof; the separate Maxim privacy checker passed.

## Regression Contracts

| ID | Contract | Evidence |
| --- | --- | --- |
| DI-01 | Defaults never authorize spend/cleanup | intelligence-policy units |
| DI-02 | UTF-8/control-heavy bounded screening | packing unit + Rust |
| DI-03 | Small-batch exploration and diversity | Rust |
| DI-04 | Per-source rotation and paged intake | intelligence-intake integration |
| DI-05 | Requests/tokens/cost and serial leases | intelligence integration, two workers |
| DI-06 | Interrupted sends never redispatch | intelligence-recovery integration |
| DI-07 | Unsent preflight refunds / wall-clock fences | intelligence-guards integration |
| DI-08 | Rejected job and 200-row prefix cannot starve queue | intelligence-guards integration |
| DI-09 | Save-after-preview fences compaction | intelligence-retention integration |
| DI-10 | Restore/rearchive retains qualifications and identity | intelligence-retention integration |
| DI-11 | Live policy inputs survive raw-cache expiry | intelligence-intake integration |
| DI-12 | Unknown outcomes still consume unsubmitted slots | intelligence-retention integration |
| DI-13 | Global filtering/facets precede pagination | job-filters + existing job-fit integration |
| DI-14 | Partial changes preserve policy, human approves chat proposals | policy unit + intelligence integration |
| DI-15 | Corrected/deduplicated submission flow and stale-fit removal | Home integration + Rust |
| DI-16 | Eight metrics, graph, cohort race, lane reset and mobile | Home Chromium |
| DI-17 | Actual settings, cleanup table, restore and URL reload | intelligence Chromium |
| DI-18 | Original authority/browser/integration/native contracts remain | full app/native/Go/safety suites |

## Review And Visual Evidence

Installed EGM drift-report guidance plus separate source-only fresh-context audits
were used. The implementation reviews found thirteen concrete issues; fixes cover
dispatch preflight/day/lease fences, queue and source-prefix starvation, restore
preservation, live normalized policy inputs, capacity accounting, opening dedupe,
archive filters/facets and Home navigation/request races. Follow-up source checks
and regression tests were used; this is not a formal human-gated EGM convergence.

Inspected desktop/mobile Chromium screenshots for the multicolor nonblank flow and
work surfaces. The chart uses container width on desktop and a bounded horizontal
scroll surface on narrow screens, with a readable flow table. No external images,
private candidate records or fallback metrics are required for the diagram.

## Local Deployment Check

Created a private database/artifact backup before applying migrations 013-015.
Restarted only Maxim's owned web/worker processes and Compose database; no unrelated
projects, images or volumes were pruned. The workspace is served at
`http://127.0.0.1:3010/maxim`. Health, schema 15 and authenticated read-only
Home/settings checks passed. No real provider evaluation or production compaction
was used as a smoke test. Access keys, cookies, database URLs and candidate records
are not included in this receipt.

## Owner And Live Gates

- Production schedules, paid automatic evaluations and cleanup remain disabled
  until the owner saves/enables their exact settings and permissions.
- Public-board coverage is bounded, not universal LinkedIn/Indeed/Workday search.
- Exact provider model/task access and prices require owner review. Local pricing
  estimates cannot prove provider billing. Manual model tasks are outside the
  automatic evaluation allowance.
- Production compaction was not used as a test. Protected submitted evidence,
  native projections and private backups were not deleted.
- Gmail/Discord and final application submission retain their existing separate
  owner/manual gates. No original MVP live gate is promoted by these fixtures.
