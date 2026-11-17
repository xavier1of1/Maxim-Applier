# S11: Product and demonstration acceptance

**Status:** Pending implementation. Detailed plan drafted; no acceptance criterion is claimed passed.
**Updated:** 2026-11-16.
**Roadmap:** [Stage index](README.md) | [High-level roadmap](../high-level-roadmap.md) | [Shared contracts](contracts.md)
**Requires:** [S6](stage-06-browser-assistance.md)

> **How to pick this up:** Implement only this file's Scope and Acceptance, in the ordered slices below. Existing paths are evidence, not a promise of compatible behavior. Proposed files/tests do not exist until implemented. Dependencies require their own recorded proof; planning status never satisfies them.

## Objective

Accept an explicitly scoped assisted-application product and rehearse the recruiter demonstration with true data lineage, manual final-action control and recoverability.

## Thin Vertical Slice

- **Narrowness axis:** one approved candidate fixture, one real or explicitly isolated job, one supported form variant, one remembered unknown answer and one canonical application.
- **E2E path:** start documented stack; onboard/review; add/search role; recall knowledge; evaluate with Career-Ops; approve packet; prepare visible supported form; correct/reuse one answer; pause/resume; user manually finalizes or leaves at review; inspect same tracker state.
- **Counterexample:** service outage, unsupported form or unverified integration is shown honestly, never covered by sample fallback or a claimed submission.
- **Outside this slice:** shipping every optional stage by November 19, universal ATS support or unsupported live claims.

## Delivery Profiles And Scope

| Profile | Required proof | What it may claim |
| --- | --- | --- |
| Foundation rehearsal | S0-S3 | Real workspace, reviewed knowledge and recall only; not full S11 acceptance |
| Assisted-application acceptance | S0-S3, S5, S6 | Supported conversational form assistance with manual final action |
| Discovery extension | Add S4 | Declared automated source/search coverage |
| Mail/notification extension | Add S7/S8 as claimed | Consented real observations/delivery, not assistant plugin presence |
| Networking/practice extension | Add S9/S10 as claimed | Verified optional workflow, not every listed skill |

S6 is mandatory to mark this product-acceptance stage Shipped. A smaller foundation demonstration is useful but receives a narrower milestone record, not a silent substitution for application assistance.

A fixture form must be labeled an isolated test. For real-site support claims, include the consented dated site/form-variant smoke from S6 and state limitations. Final real submission remains Xavier's action.

## Scope And Contracts

- Freeze audience/duration/script, included stages/sites/providers, live versus synthetic data and permitted screen-share details.
- Trace candidate/source/answer/job/evaluation/packet/application/event IDs and revisions through the whole path. No manual reconciliation of competing trackers.
- Include the actual visible browser/review experience, not only generated answer text or a static dashboard. Do not revive the rejected runner to meet the date.
- Rehearse documented host/Compose startup, dedicated browser ownership, worker recovery and protected data restore.
- Verify model/provider/API failures, unknown fields, correction propagation, stale packet/session and integration revocation with a clearly described fallback.
- Run practical native/new build/unit/integration/UI/safety checks in isolated scope; bound unavailable external tests rather than counting them as pass.
- Produce a What Shipped record with exact tested versions/environment/commands, included case results, screenshots/artifact hashes where safe, residual risks and supported-site matrix.

## Ordered Implementation Slices

| Slice | Action | Evidence |
| --- | --- | --- |
| DEM-A | Freeze the delivery/demo profile and script | Included capabilities/dependencies and honest exclusions |
| DEM-B | End-to-end and denial/recovery rehearsal | Same canonical IDs, visible review and no hidden fixtures |
| DEM-C | Regression/privacy/setup verification | Dated output, protected screen-share material |
| DEM-D | Second rehearsal and acceptance record | Repeatable operation and remaining manual setup |

No day-by-day promise follows from this plan. Reduce the claim explicitly if the proved slice cannot fit the demo date.

## Acceptance

- [ ] **DEM-01:** Approved script/profile names exact surfaces, sites, providers, live/fixture distinction, duration and limitations; S6 is present for assisted-application acceptance.
- [ ] **DEM-02:** Onboarding/fact/answer/job/evaluation/packet/application lineage is consistent across UI/agent/artifacts after restart, with no manual tracker reconciliation.
- [ ] **DEM-03:** One unknown answer is approved, reused in correct scope, corrected and withheld from stale reuse; no unsupported candidate claim appears in the packet/form.
- [ ] **DEM-04:** Supported visible browser path reaches meaningful review; final action remains user-controlled and submitted outcome is never inferred from a fill.
- [ ] **DEM-05:** Two rehearsals exercise restart/recovery plus one provider/backend/unknown-control failure; unsupported states remain usable and truthful.
- [ ] **DEM-06:** Every claimed optional integration/stage has its own passing proof and actual setup; unrun/blocked tests and known defects are recorded, not hidden.
- [ ] **DEM-07:** Secrets, real mail/contacts, proprietary employer evidence, private sessions and production traces are absent from public demonstration artifacts/Git.
- [ ] **DEM-08:** Actual start/stop/restore commands, environment/version pins, selected test output and What Shipped are recorded; acceptance checkboxes are backed by executed evidence.

## Integration Test

**Proposed:** `node --test maxim/app/tests/integration/product-acceptance.test.mjs` and `maxim/app/tests/e2e/product-acceptance.spec.mjs`.

Run against the actual app/DB/worker/browser path, using a seeded isolated fixture plus the selected consented live smoke. Assert HTTP/tool payloads, storage and server-side denied effects, not only screenshots or final model prose.

Record all included-stage test commands and practical native regressions. Never run normalize/dedup/merge against real personal trackers merely to produce a green baseline. Live Discord/Gmail/browser actions require their separate scope/consent; tests do not send applications.

The document validator proves the plan's structure and handoffs, not these future product outcomes.

## Files Changed

~~~text
maxim/app/tests/integration/product-acceptance.test.mjs
maxim/app/tests/e2e/product-acceptance.spec.mjs
docs/maxim/testing/                             dated acceptance/rehearsal evidence
docs/maxim/setup.md                             actual tested start/stop/recovery instructions
docs/maxim/implementation_status.md              per-stage delivered facts, not plan claims
docs/maxim/                                     supported sites, privacy and limitations
roadmap/stages/                                 update What Shipped only from evidence
~~~
No new product features are slipped into acceptance. Failed criteria return to the producing stage.

## Dependencies And Handoff

Requires S6 and its transitive dependencies. Add S4/S7/S8/S9/S10 only for explicitly claimed optional capabilities; their conditional dependencies must also pass.

Produces **accepted-delivery-profile** for daily use and recruiter explanation. The user receives actual commands/URL, known limits and the next bounded work item.

## What Shipped

Pending. Detailed documents and a passing roadmap validator are not a completed MVP or a promise of November 19 readiness.

## Deferred To Later Stages

All unselected integrations/platforms/skills, unattended final submission and broad scale. Retain a separate backlog rather than hiding these behind disabled controls.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
