# S3 Answer Memory Acceptance

Verified: 2026-11-17. Built on S2 commit 63556f9.
No personal candidate facts or answers were imported/approved by these tests.

## Executed Checks

`npm --prefix maxim/app test` passed on the final implementation:
14 Rust tests, 10 tokenizer/parser/policy unit tests, 42 integration TAP cases
(including suite parents), 10 production Chromium workflows. TypeScript and production
Next/Astryx build pass without tracing warnings. Static website safety also passes.

Environment: Windows; Node 24.22.3; Rust 1.76 MSVC; PostgreSQL 18.1 disposable Docker;
Next 16.4.6/React 19.3.1/Astryx 0.7.16; Microsoft tokenizer 1.0.10 with pinned
official ranks; captured scripted model; Playwright Chromium.

## Case Evidence

| Case | Actual service/UI proof | Result |
| --- | --- | --- |
| MEM-01 | Exact typed fact beats a conflicting stored name; company-specific answer beats newer cross-company answer; explicit cross-company fallback returns the same candidate's IDs/revisions/context | Passed |
| MEM-02 | Missing citizenship is unknown; explicit false clearance remains false; role/context/punctuation mismatch and contradictory approved answers ask the user; salary/availability/employer relations and voluntary declarations are held | Passed |
| MEM-03 | Pending/history-only/revoked/expired/undisclosed/private-without-consent and second-workspace answers are withheld before model/fill output | Passed |
| MEM-04 | Content-hash/answer/candidate/fact revision binding, explicit declaration acknowledgment, stale rejection, idempotent approval and undeclared model self-approval denial | Passed |
| MEM-05 | Fact correction invalidates current answers/reuses; new correction requires approval; previous version remains recorded; submitted snapshot survives correction/deletion; in-flight revocation blocks the next model request | Passed |
| MEM-06 | Actual Microsoft BPE vector, Unicode and ordinary special-token round trip; whole JSON/schema/history/evidence count; explicit framing/margin/output reserve; byte/tiny-budget refusal and unsupported model before transmission; local/provider usage stored separately | Passed |
| MEM-07 | UI/agent share exact answer IDs/revisions; actual web and database restart retain them; cancelled origin run cannot approve its draft; current-user quote and extractive reviewed-fact drafts remain unapproved/history-only | Passed |
| MEM-08 | Authorized export and other-identity denial; source-driven answer/version/chat erasure; raw question context erased only after its last retained owner; expired memory redacted; submitted historical snapshot preserved | Passed |

## Race And Browser Evidence

A fixture database trigger holds a real tool-message publication after scoped recall.
Revoking the answer while held invalidates the run dependencies. Releasing the barrier
produces cancellation with only the initial model request captured: revoked evidence
never enters a second call.

Production desktop (1600x1000) and mobile (390x1000) tests perform unknown lookup,
draft/permission selection, exact approval, cross-company recall, reviewed reuse,
reload/correction, invalidation and erasure. Screenshots were inspected; no horizontal
overflow, incoherent control overlap or browser page errors. S1/S2 UI, keyboard,
offline/error/no-key/manual and worker recovery regressions remain green.

Initial failures exposed and fixed a UUID/text SQL parameter mismatch in erasure and
missing semantic region markup. A shared question correctly remains when another
retained answer owns it; the final-answer/source-erasure case separately proves full
unshared question/context redaction. Failures were not promoted as passes.

## Deliberate Boundaries

Fixture usage is not real provider billing or live account/model-quality certification.
The counter's complete serialization plus explicit framing/margin is not exact API billing.
No browser fill, submission, Gmail/Discord delivery or native tracker cutover occurred.
S3 has no submission endpoint; submitted history is inserted only in an isolated policy
fixture to prove the S5 contract. Memory source approval is not employment verification.

Same-context EGM implementation/design consistency review only, not independent
Goldfish review or convergence. S4/S5 remain separate unverified stages at this checkpoint.

