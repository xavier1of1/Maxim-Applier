# S10: Evidence-grounded interview preparation

**Status:** Pending implementation. Detailed plan drafted; no acceptance criterion is claimed passed.
**Updated:** 2026-11-16.
**Roadmap:** [Stage index](README.md) | [High-level roadmap](../high-level-roadmap.md) | [Shared contracts](contracts.md)
**Requires:** [S5](stage-05-evaluation-and-tracker-cutover.md)

> **How to pick this up:** Implement only this file's Scope and Acceptance, in the ordered slices below. Existing paths are evidence, not a promise of compatible behavior. Proposed files/tests do not exist until implemented. Dependencies require their own recorded proof; planning status never satisfies them.

## Objective

Provide optional project-defense, behavioral and system-design practice grounded in the candidate's real evidence and the selected role.

## Thin Vertical Slice

- **Narrowness axis:** one stored role, one explicit practice mode, one saved session/feedback record.
- **E2E path:** choose project defense for a role; retrieve approved project evidence; practice a response; flag unsupported claims; save feedback separately from facts; resume after restart.
- **Counterexample:** a hypothetical practice answer or community question cannot become approved resume truth or a guaranteed employer interview question.
- **Outside this slice:** all Cracked skills, coding-assessment assistance, a second profile/journal store, a new fit score.

## Current Evidence And Boundary

Career-Ops already has interview-prep modes and story-bank files. The external Cracked pack and Hiring Panel are not installed product integrations. S5 owns optional resume critique; this stage owns practice, not another packet approval gate.

Use instruction/workflow ideas only after source/license/dependency review. Do not execute arbitrary skill scripts or add a separate ~/.cracked candidate authority.

## Scope And Contracts

- Add user-invoked practice modes for project defense, behavioral/STAR and relevant system-design, with explicit role/candidate/evidence references.
- Reuse approved source facts and bounded S3 context. Missing metrics/experience trigger questions; hypothetical phrasing remains clearly unapproved.
- Keep session messages, practice attempts, feedback/rubric and source revisions distinct from facts/answer reuse approvals. Confirm any promotion through existing candidate/answer commands.
- Persist private practice artifacts under the same storage/retention boundary; apply correction/revocation to future recall.
- Label community company intel as unverified practice context. No claim of actual ATS/hiring probability or guaranteed company questions.
- Budget/cancel model calls and allow a focused practice without multi-agent fan-out. Full optional skill workflows are not required.
- Code execution is off by default. If later enabled, require a separate execution sandbox/consent with strict resources/network boundaries; no live-assessment cheating.
- Integrate role/application practice entry points in the existing UI/agent, not a separate interview product.

## Ordered Implementation Slices

| Slice | Action | Result |
| --- | --- | --- |
| INT-A | Select/adapt licensed prompts and candidate-context binding | Narrow evidence-grounded practice |
| INT-B | Session/feedback storage and role-linked UI/agent | Restartable private practice, not truth promotion |
| INT-C | Source correction, cost/cancel and hypothetical-answer controls | Safe feedback/reuse behavior |
| INT-D | Quality fixture and optional consented live model smoke | Supportable practice claims |

## Acceptance

- [ ] **INT-01:** Selected practice mode consumes the current approved candidate/role evidence and asks about missing experience rather than fabricating it.
- [ ] **INT-02:** Session/feedback persists across restart with same IDs/revisions and no parallel candidate profile.
- [ ] **INT-03:** Hypothetical/mock answers and community intel are labeled; no automatic promotion to facts, application answers or employer-question certainty occurs.
- [ ] **INT-04:** Corrections/revocations/second identity prevent unauthorized or stale evidence reuse; artifacts follow private retention/deletion policy.
- [ ] **INT-05:** Model budget/cancel/failure states are explicit; no mandatory fan-out or candidate-code execution runs without separate consent/sandbox.
- [ ] **INT-06:** UI/agent share the same practice service and link to the selected role; Career-Ops interview-prep compatibility and sole fit-score authority remain intact.

## Integration Test

**Proposed:** `node --test maxim/app/tests/integration/interview-practice.test.mjs` and `maxim/app/tests/e2e/interview-practice.spec.mjs`.

Use synthetic public-style project evidence, a missing achievement, a hypothetical invented metric, revoked fact, cancellation and two identities. Assert captured context and canonical facts remain unchanged. A scripted model proves plumbing; qualitative live practice review is separate.

Do not run candidate code or real interviews as automatic tests.

## Files Changed

~~~text
maxim/app/src/server/interview/                  selected workflows/session/feedback
maxim/app/src/app/                              role-linked practice workspace
maxim/app/src/components/                       practice controls/evidence/feedback
maxim/db/postgres/                               session and artifact references
maxim/app/tests/{integration,e2e,fixtures}/
modes/interview-prep.md                          narrow compatibility adapter if needed
docs/maxim/                                     actual practice/data-retention instructions
~~~
The native interview-prep mode exists; patch only its compatibility boundary and do not overwrite story-bank/user content. No wholesale external skill installation is implied.

## Dependencies And Handoff

Requires S5 (including S3 context and approved facts). Produces **interview-practice**.

Optional parallel lane: no dependence on Gmail, Discord or S9. It cannot delay the S6 application-assistance proof. S11 includes it only if explicitly claimed.

## What Shipped

Pending. No practice answers are created or approved by this planning stage.

## Deferred To Later Stages

Broad DSA/coaching programs, code execution, wearable interview interaction and automatic reuse of mock answers. Optional content additions need their own outcome/budget tests.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
