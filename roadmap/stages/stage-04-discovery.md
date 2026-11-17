# S4: Coverage-aware discovery

**Status:** Pending implementation. Detailed plan drafted; no acceptance criterion is claimed passed.
**Updated:** 2026-11-16.
**Roadmap:** [Stage index](README.md) | [High-level roadmap](../high-level-roadmap.md) | [Shared contracts](contracts.md)
**Requires:** [S2](stage-02-reviewed-onboarding.md)

> **How to pick this up:** Implement only this file's Scope and Acceptance, in the ordered slices below. Existing paths are evidence, not a promise of compatible behavior. Proposed files/tests do not exist until implemented. Dependencies require their own recorded proof; planning status never satisfies them.

## Objective

Make job discovery useful and auditable while exposing failures, incomplete coverage and unsupported company sites.

## Thin Vertical Slice

- **Narrowness axis:** one retained supported feed, one explicit unsupported/failed source, one normalized search run with saved/dismissed results.
- **E2E path:** user/agent starts a bounded query; worker records source attempts; a new role enters once with source aliases; UI/agent inspect result/history; the unsupported source remains actionable.
- **Counterexample:** quota failure, incomplete pagination or location broadening cannot look like an empty successful scan.
- **Outside this slice:** all 224 configured companies working automatically, universal internet search, application-site automation.

## Current Evidence And Boundary

[scan.mjs](../../scan.mjs) discovers provider modules and writes pipeline/history files. It is not a pure web API. [audit-sources.mjs](../../maxim/scripts/audit-sources.mjs) is an offline classification tool, not live coverage proof; its help test currently fails.

Retain useful provider logic; don't import a CLI entry point that executes scans or writes the user's tracker on module load. An isolated native invocation must have explicit read/write roots and parsed outputs.

## Scope And Contracts

- Model source definitions, search/run/attempt/page observations, query/filter versions, saved/dismissed state and source-specific failure obligations.
- Reuse provider functions through a narrow adapter or a bounded isolated native process. Do not rewrite scanners merely to add UI.
- Distinguish discovery provider, original platform and application destination. Persist external job IDs/URLs as aliases to stable openings; never merge distinct job IDs by similar titles alone.
- Separate posted time from first seen and source freshness from job relevance. No known posting time means unknown freshness.
- Use S2 durable work for scans/searches, paging/cursor progress, cancellation and bounded retries. Persist selected methods and unsupported/manual fallbacks.
- First prove direct feed fixtures and one consented public-source smoke. Broad JSearch/Adzuna/FreeHire is an optional provider experiment with setup/coverage/cost/terms gates; no new subscription is mandatory.
- Validate URLs/redirects/DNS and prevent SSRF/private-network access except isolated explicit test fixtures. Limit response size, requests, concurrency, pacing and retry by provider policy.
- Apply approved NoVA/DC/salary/clearance policies after provider normalization; preserve unknowns. Search defaults use reviewed preferences, not only the person's current job title.
- Show Search/Past searches/Saved/Dismissed and source health through the early workspace and matching agent tools.

## Ordered Implementation Slices

| Slice | Action | Result |
| --- | --- | --- |
| DSC-A | Fix/read-only audit contract and map supported native provider seams | Supported/unsupported configuration, not claimed live coverage |
| DSC-B | Source/run/page/job-alias schema and canonical ingestion | Idempotent new opening and distinct alias identity |
| DSC-C | Worker/provider adapter with explicit limits/errors | Recoverable bounded scan and partial-page state |
| DSC-D | UI/agent query/history/save/dismiss views | Same jobs and coverage state across surfaces |
| DSC-E | Optional broad-provider comparison and declared live smoke | Measured scope/cost, no silent expansion |

## Acceptance

- [ ] **DSC-01:** Read-only source audit/help runs without candidate files or scanning; invalid/disabled/explicit/unmatched configuration remains distinct.
- [ ] **DSC-02:** New role and repeated/multiple-source observations create one correct opening with aliases; distinct job IDs/materially distinct openings do not silently merge.
- [ ] **DSC-03:** Posted/first-seen/check timestamps and query/filter/source lineage persist; missing dates remain unknown.
- [ ] **DSC-04:** Empty-success, partial-pagination, stale, unsupported, auth/challenge, quota, HTTP and parse failures have distinct visible states and fallback responsibility.
- [ ] **DSC-05:** Restart/cancel/retry resumes only eligible work with bounded pagination/pacing; no accidental native tracker writes occur.
- [ ] **DSC-06:** Redirect/private-IP/metadata/DNS-change/oversize response cases are denied; no evasion or unauthorized source is introduced.
- [ ] **DSC-07:** NoVA/DC and multi-location filtering still applies when a provider broadens radius/country/location; same-named out-of-state cities are not automatically NoVA, and denied/unknown policy is explainable.
- [ ] **DSC-08:** UI and agent query/history/save/dismiss agree on IDs and status; any claimed live source has dated actual-result evidence separate from fixtures.

## Integration Test

**Available now:** `node --test maxim/tests/unit/source-readiness.test.mjs maxim/tests/unit/scan-cli-safety.test.mjs`. Source-audit help is a known failing baseline; scanner help/unknown-argument checks must not scan.

**Proposed:** `node --test maxim/app/tests/integration/discovery.test.mjs` and `maxim/app/tests/e2e/discovery.spec.mjs`.

Use real service/DB/worker paths and loopback providers with multiple pages, aliases, 429, schema drift, dates, redirects and an unsupported source. Explicitly assert that native production pipeline/history files remain unchanged. A provider account is required only for its selected live smoke, not offline fixtures.

## Files Changed

~~~text
maxim/scripts/audit-sources.mjs                  repair explicit read-only help path
providers/                                      retain native adapters; narrow seam if needed
maxim/app/src/server/discovery/                  source contracts, runs, adapters, URL policy
maxim/app/src/server/jobs/                       canonical aliases/observations
maxim/app/src/worker/discovery.ts
maxim/app/src/app/                              search/history/results/source-health views
maxim/db/postgres/                              sources, runs, attempts/pages, aliases
maxim/app/tests/{integration,e2e,fixtures}/
~~~
Proposed product files; native scan patch must preserve its existing standalone behavior until its own write cutover.

## Dependencies And Handoff

Requires S2 for reviewed preferences and the first consumed worker. Produces **discovery-runs** and **job-observations**.

S5 may already evaluate manually added jobs after S3; it consumes S4 only for roles obtained by automated discovery. S8 automated fresh alerts require this coverage evidence. Discovery support never implies destination-site fill support.

## What Shipped

Pending. The current source list is not certified complete or operational.

## Deferred To Later Stages

Browser application adapters S6; new provider expansion as explicit increments; no first-party LinkedIn/Indeed job API or platform permission inferred from aggregator results.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
