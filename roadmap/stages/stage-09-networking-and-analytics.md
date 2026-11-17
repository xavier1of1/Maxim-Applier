# S9: Networking and outcome insight

**Status:** Pending implementation. Detailed plan drafted; no acceptance criterion is claimed passed.
**Updated:** 2026-11-16.
**Roadmap:** [Stage index](README.md) | [High-level roadmap](../high-level-roadmap.md) | [Shared contracts](contracts.md)
**Requires:** [S5](stage-05-evaluation-and-tracker-cutover.md)

> **How to pick this up:** Implement only this file's Scope and Acceptance, in the ordered slices below. Existing paths are evidence, not a promise of compatible behavior. Proposed files/tests do not exist until implemented. Dependencies require their own recorded proof; planning status never satisfies them.

## Objective

Integrate useful existing networking, recruiter tracking and historical outcomes into the same workspace, with a defensible interview-rate denominator.

## Thin Vertical Slice

- **Narrowness axis:** one private synthetic contact/history import, one eligible job shortlist, one researched draft, one manual response change and one small outcome cohort.
- **E2E path:** import authorized connection data; rank for a T2/T3/connection-priority role; add person research; draft and mark sent manually; correct a recruiter tag; inspect interview-rate numerator/denominator and small-sample caveat.
- **Counterexample:** evaluated-only jobs, unknown location and duplicate historical rows do not inflate submitted applications or interview rate.
- **Outside this slice:** live LinkedIn scraping/publishing/DMs, universal contact discovery, causal strategy optimization.

## Current Evidence And Boundary

Retain concepts from [contact ranker](../../maxim/lib/contact-ranker.mjs), [networking workflow](../../maxim/lib/networking-workflow.mjs), [message builder](../../maxim/lib/message-builder.mjs), [LinkedIn research planner](../../maxim/lib/linkedin-connection-finder.mjs), [recruiter inbox](../../maxim/lib/recruiter-inbox.mjs) and [history importer](../../maxim/lib/history-importer.mjs).

[Current metrics](../../maxim/lib/metrics.mjs) filters location strings and divides by all compatible supplied records, without requiring confirmed submitted attempts. That is not yet the target submitted-application KPI; do not carry the denominator forward unchanged.

## Scope And Contracts

- Import supplied contacts or authorized connection CSV/ZIP exports with raw fields/provenance, candidate scope, optional fields and subjective strength 1-3. ZIP parsing is bounded and safe; existing import can be adapted instead of installing an entire connector.
- Prefer local contacts/supplied public research and explicit manual research tasks. The suggested LinkedIn connector does not supply jobs/Easy Apply/inbox/live people search; exclude publishing/message tools.
- Explain rank from actual company, role, research, alumni/recruiter/founder/strength evidence. A networking rank is not another job-fit score.
- Store research approval and draft validation. Required structure: person research, role, supported candidate background, fit rationale, CTA. Missing research/claims remain draft/review work.
- Preserve ready_to_send, sent_manually, replied, follow_up_due, referral_asked, referred, declined, no_response; reruns do not reset manual history.
- Adapt recruiter tags/corrections and Needs Response using canonical tasks/events; recorded reply clears it, stale retry does not reopen it.
- Preserve raw historical workbook/CSV separately from normalized rows; Interview Round is high-trust interview evidence after explicit interpretation, Application Status remains raw/soft. Reconcile duplicate legacy IDs/statuses and artifacts with S5 mappings.
- Compute rate for declared submitted/cohort/as-of NoVA/DC attempts; distinguish unknown location/outcome, immature cohorts and missing metadata. No denominator from all evaluated/discovered jobs.
- Show score/tier/source/lane/variant/networking/strength/freshness breakdowns with counts and small-sample warning. 0/0 is unavailable; don't imply success/failure from no data.

## Ordered Implementation Slices

| Slice | Action | Result |
| --- | --- | --- |
| NET-A | Contact/history import/provenance and ownership adaptation | Idempotent raw-preserving records, no second SQLite writer |
| NET-B | Explained shortlist/research/draft queue | Required structure and approved evidence |
| NET-C | Manual statuses/recruiter correction/response tasks | Rerun/replay-safe workflow |
| NET-D | Cohort/KPI and segmentation contract | Testable submitted denominator and unknown buckets |
| NET-E | Workspace/agent views and source-linked exports | Same records, no private data in public/demo files |

## Acceptance

- [ ] **NET-01:** Contact/history imports preserve raw bytes/fields and stable identity, validate safe archive/CSV/XLSX handling, and rerun without duplicate normalized actions.
- [ ] **NET-02:** Optional contact fields and strength 1-3 validate; ranking cites real inputs and unrelated contacts do not qualify merely from generic engineering keywords.
- [ ] **NET-03:** Drafts require the five parts plus approved person/candidate evidence; unknown research/claims cannot be marked ready silently.
- [ ] **NET-04:** Manual send/reply/follow-up/referral states and recruiter corrections persist; reruns/old mail evidence do not reset or revive resolved work.
- [ ] **NET-05:** No LinkedIn/social publish/DM tool or hidden platform action exists; export/manual public research works without a LinkedIn login.
- [ ] **NET-06:** Interview-rate numerator is unique submitted compatible attempts with accepted interview evidence; denominator uses normalized location policy, excludes evaluated-only/duplicate/unknown-location rows and reports exclusions.
- [ ] **NET-07:** Empty/small/immature cohorts, raw soft statuses, conflicting interview fields and unavailable variant/freshness dimensions are displayed honestly without causal conclusions or automatic scoring changes.
- [ ] **NET-08:** UI/agent/privacy and store cutover agree on contacts/drafts/history/metrics after restart; outputs and fixtures do not expose real contacts or private employer evidence.

## Integration Test

**Existing regression references:** unit contact/ranking/message/history/metrics tests and `maxim/tests/integration/networking-store.test.mjs`, `history-import-store.test.mjs`. Their SQLite success is not new canonical-store evidence.

**Proposed:** `node --test maxim/app/tests/integration/networking-and-metrics.test.mjs` plus `maxim/app/tests/e2e/networking-and-metrics.spec.mjs`.

Seed a reviewed synthetic history with discovered/evaluated/submitted/interview, different openings and duplicate source rows; assert exact numerator/denominator/exclusion counts. Add unknown location, missing dates, malformed strength, conflicting raw outcomes and a status rerun. Test a researched draft with missing/unsupported candidate claim and an unauthorized read.

## Files Changed

~~~text
maxim/app/src/server/{contacts,networking,recruiter-tasks,history,metrics}/
maxim/app/src/app/                              shortlist/drafts/recruiter/history/analytics views
maxim/db/postgres/                               adapted contacts/research/manual states/imports
maxim/lib/{contact-ranker,message-builder,metrics,history-importer}.mjs
                                                retain pure logic; adapt only approved boundaries
maxim/scripts/                                 canonical import/draft/status adapters or gates
maxim/app/tests/{integration,e2e,fixtures}/
docs/maxim/data_onboarding_guide.md              actual authorized imports/approval instructions
~~~
Preserve raw private data and useful native contacto/story-bank behavior. No generic deletion of non-Career-Ops networking.

## Dependencies And Handoff

Requires S5, which transitively supplies S3. Produces **networking-queue** and **outcome-metrics**. Live Gmail-derived recruiter evidence additionally needs S7; manual records do not.

S8 may consume these queues only after this contract is available; its early job/progress alerts remain independent. S11 includes this stage only if it claims the networking/analytics experience.

## What Shipped

Pending. Current imported personal contacts/history are not inspected or reinterpreted by the plan.

## Deferred To Later Stages

Large-scale new source discovery, automated LinkedIn messaging, offer/strategy optimization from insufficient samples, and connector permissions beyond authorized export import.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
