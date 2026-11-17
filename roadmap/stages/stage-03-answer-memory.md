# S3: Reusable answers and bounded context

**Status:** Verified for the reusable-answer and bounded-context scope.
**Updated:** 2026-11-17.
**Roadmap:** [Stage index](README.md) | [High-level roadmap](../high-level-roadmap.md) | [Shared contracts](contracts.md)
**Requires:** [S2](stage-02-reviewed-onboarding.md)

> **How to pick this up:** Implement only this file's Scope and Acceptance, in the ordered slices below. Existing paths are evidence, not a promise of compatible behavior. Proposed files/tests do not exist until implemented. Dependencies require their own recorded proof; planning status never satisfies them.

## Objective

Let a user answer once and safely reuse that answer without losing scope, evidence, correction or context-budget control.

## Thin Vertical Slice

- **Narrowness axis:** one standard fact lookup and one tagged novel question with company-specific and cross-company approved answers.
- **E2E path:** an unknown question prompts the user; save/approve an answer; recall company-first; approve a compatible reuse; correct/revoke the source; prove old reuse disappears from UI, agent and future packet preparation.
- **Counterexample:** another candidate, stale fact, compensation ambiguity or voluntary self-ID never becomes an automatic answer.
- **Outside this slice:** vector infrastructure, browser execution, external skill-owned memory, universal semantic correctness.

## Current Evidence And Boundary

The former file/env planner and application mapper were rejected and retired in S5. Their useful unknown/sensitive-field scenarios survive in the [browser safety handoff](../../maxim/tests/fixtures/browser-safety-handoff.json); they are not a reusable answer service or a delivered S6 executor.

Candidate facts and durable work are supplied by S2. Do not create a second profile under a skill's home directory or save a model summary as approved candidate truth.

## Scope And Contracts

- Separate exact question/context, answer revisions, supporting fact/source revisions, sensitivity, reuse permission, status and actual uses.
- Retrieval order: direct standard facts, current-company approved answers, then compatible cross-company answers for the same candidate. Apply approval/sensitivity/revision filters before retrieval results reach a model.
- Return explainable answer candidates with references and unresolved questions; adaptation is a draft until the required confirmation. Material uncertainty asks the user.
- Special handling for employer relationships, salary, availability, attestations, demographics and credentials. Never convert the absence of a boolean answer into Yes or No.
- Persist correction/revocation and dependent-draft invalidation atomically. Already submitted artifacts are historical; deleting a current answer must not silently rewrite them.
- Implement bounded context building from typed reads and lexical/full-text search; don't load whole histories/documents. Keep conversation ordering and safe checkpoints distinct from approved facts.
- Validate the chosen counter/model framing. Microsoft Tokenizer is conditional; unsupported encodings are explicit. Count instructions, schemas, tool results/history, retrieved evidence and output reserve; compare estimates to provider usage without asserting exact billing equality.
- Expose inspect/approve/correct/revoke controls in the existing workspace and the same service-backed agent tools.

## Ordered Implementation Slices

| Slice | Action | Result |
| --- | --- | --- |
| MEM-A | Versioned question/answer/use schema and sensitivity policy | Stored history distinct from fill permission |
| MEM-B | Deterministic typed/tag/lexical retrieval and filtering | Scoped explained results before model calls |
| MEM-C | Unknown-question conversation and explicit answer confirmation | User repeats neither data entry nor approval accidentally |
| MEM-D | Correction/revocation and dependency invalidation | Old answer cannot be silently reused |
| MEM-E | Complete context budget + usage instrumentation | Predictable refusal/truncation policy with no skipped mandatory policy |

## Acceptance

- [x] **MEM-01:** Standard facts precede employer-specific and compatible same-candidate cross-employer answers; source/revision/scope explanations are returned.
- [x] **MEM-02:** Unknown, contradictory or materially ambiguous questions ask the user, and missing booleans remain unknown.
- [x] **MEM-03:** Stored-unapproved, sensitive-without-consent, withdrawn, expired and cross-candidate answers are withheld from fill and model context.
- [x] **MEM-04:** Explicit approval binds exact answer/context/revisions; duplicate/stale/self-confirmation attempts cannot broaden reuse.
- [x] **MEM-05:** Correction/revocation changes future recall and invalidates dependent current drafts; submitted historical versions are unchanged.
- [x] **MEM-06:** Context compilation stays within a declared model-specific hard request/output budget; oversize mandatory context or unsupported tokenization yields an honest refusal/estimate policy.
- [x] **MEM-07:** UI and agent inspection/confirmation return the same answer revision after restart; cancelled model calls don't approve memory.
- [x] **MEM-08:** Retention/delete/export and source authorization tests prevent private context leakage into unrelated prompts, events or other identities.

## Integration Test

**Implemented:** `npm --prefix maxim/app test` runs the actual
[answer integration](../../maxim/app/tests/integration/answer-memory.test.mjs),
[answer UI](../../maxim/app/tests/e2e/answer-memory.spec.mjs), Rust/tokenizer/parser
unit tests, type/build and S1/S2 regressions.

Use S1/S2's actual service/DB path with two candidates, two employers, conflicting answers, correction/revocation and an oversize synthetic context. Capture complete model input and tool outputs, not only answer prose. Test a source revision change between proposal and confirmation.

Define numeric budgets in tested deployment config; use deliberately small fixture budgets to exercise refusal. Do not fake provider token accuracy with a string-length heuristic.

## Files Changed

~~~text
maxim/app/src/server/{answers,retrieval,context}/
maxim/app/src/server/models/                    model/counter capability and usage
maxim/app/src/server/candidates/                revision dependency invalidation
maxim/app/src/app/                              answer library and review routes
maxim/app/src/components/                       scope/source/correction controls
maxim/db/postgres/                              questions, answers, uses, dependencies
maxim/app/tests/{integration,e2e,fixtures}/
~~~
Proposed new product paths; preserve native profile interfaces through S2 projections rather than expanding the rejected planner.

## Dependencies And Handoff

Requires S2. Produces **answer-recall** and **context-budget** for S5/S6 and optional practice.

S4 can run in parallel after S2. No search/site integration is necessary to prove answer recall. A supported local counter needs no service account; consented model adaptation uses the chosen provider/budget.

## What Shipped

Versioned exact questions/context, reviewed answer revisions, fact dependencies,
company-first/explicit cross-company recall, corrections/revocation, reuse review,
retention/erasure/export and current agent tools are implemented. Rust classifies
standard/special questions conservatively. Microsoft Tokenizer uses pinned local
official ranks and full-request accounting with separate provider usage.

Agent drafts quote a current declaration or preserve exact reviewed fact text;
neither grants reuse/disclosure or approval. Current-use invalidation and in-flight
run fencing prevent stale reuse; submitted snapshots remain historical.
No personal facts or answers were imported/approved during implementation.

See [case evidence](../reviews/s3-answer-memory.md),
[operation](../../docs/maxim/answer-memory.md) and
[ADR 0008](../../docs/maxim/decisions/0008-answer-memory-and-token-accounting.md).
The final suite passed 14 Rust, 10 unit, 42 integration TAP cases and 10 Chromium workflows.
Proposed directory groups resolve to the repository's flat server module convention.

## Deferred To Later Stages

Application packet usage S5, browser fields S6, practice S10; embeddings/reranking only after a documented recall gap; no credentials in answer memory.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
