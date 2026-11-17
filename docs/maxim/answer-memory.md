# Answer Memory And Context

Updated: 2026-11-17. Verified S3 services; case evidence is in [S3 acceptance](../../roadmap/reviews/s3-answer-memory.md).

## Use Answers

1. Start the workspace with `npm run maxim:workspace`, sign in and open Answers (More/navigation on mobile).
2. Activate reviewed Candidate authority first for reuse. Before activation, answers can be recorded/reviewed but recall is paused.
3. Enter the exact application question, company and role lane. Question context supports text/boolean/number/choice, exact choice options and topic tags. Click Find answer.
4. A current standard fact wins before historical answers. Missing values remain unknown; the system never turns an absent boolean into No. Private facts require the explicit local-lookup checkbox and never enter a general model tool response.
5. Unknown or incompatible questions ask you. Record answer stores a draft with exact question/context, retention, permissions and selected current fact revisions. With no selected facts, it is an explicit user declaration, not externally verified experience.
6. Inspect the draft. Check the exact text, context, evidence, expiry, local private permission and future model disclosure. Explicitly confirm before Approve answer. Approval does not mean the answer may be used everywhere.
7. Find answer uses the current company's approved exact-context answer before compatible, explicitly cross-company answers for the same candidate. Multiple conflicting current answers require a decision. Related tag history is never automatically reusable.
8. Review reuse creates a separate draft bound to exact target question/context, answer revision and content hash. Confirm reuse records your review; it does not fill a browser or submit an application.
9. Draft correction creates a new unapproved revision and invalidates outstanding reuses. Revoke answer removes future recall permission; Delete answer erases current copies and non-submitted drafts. Reasons and revision checks protect destructive changes.
10. Export answer memory downloads authorized JSON, including versions and uses. Current UI shows recent 200 questions/answers and 100 uses; partial coverage is labeled. Recall examines at most 25 matching rows and returns up to five human candidates/two bounded model candidates. Refine context when coverage is partial.

Questions with active answers/reuses cannot be deleted independently. Unanswered questions have a reviewed delete control. Deleting the last retained answer also erases unshared question context/options and applicable non-submitted reuse copies. A shared question remains while another retained answer legitimately owns it.

## Scope And Sensitivity

A company key only folds case, Unicode compatibility and whitespace. It does not invent company aliases. Reuse preserves internal question punctuation (C++ is not C#), role lane, locale, answer type and exact options. Supported locale context is en-US/en-GB. An adaptation to different context is a new draft and confirmation, not permission inherited from a vaguely related answer.

Permissions:
- Company: current company and compatible exact question/context.
- Cross-company: explicitly permits the same candidate's compatible context at another company.
- Never: searchable local history, no automatic recall/fill permission.

Status, permission, evidence freshness, source authorization, sensitivity and expiry are checked before an answer enters model context. A private supporting fact cannot be laundered through a standard answer. Approval/source permission changes are checked again at confirmation and before subsequent model turns.

Salary/compensation, availability and employer relationships require a current application-specific declaration, not blind remembered prefill. Attestations, voluntary self-ID and credential/secret requests are never automatically answered from memory. Active clearance is not inferred from citizenship or willingness. A question about U.S. work authorization is not silently equated to citizenship.

## Conversation And Drafting

The same service handlers back dashboard actions and these agent tools:
- `recall_application_answer`: filtered, explainable current fact/company/cross-company recall.
- `propose_application_answer`: exact current user declaration only; draft, history-only permission and no future disclosure.
- `draft_answer_from_facts`: selects up to five current approved disclosable facts and preserves their exact values in an extractive draft. It does not invent a polished claim, date, metric or credential. Review/edit the draft before approving it.

Candidate context/proposal and job tools remain available. No model tool approves an answer, confirms a reuse, exports all memory, executes a shell, fills a browser, sends a message or submits an application.

An agent draft must originate from a completed run before human approval. Cancelled/incomplete runs cannot grant memory. Saved conversation history is untrusted context, not approved candidate truth. Undisclosed drafts and invalidated source/answer-dependent runs are excluded from future prompts. Revocation during tool publication aborts the next model request rather than sending stale evidence.

## Local Token Accounting

The installed Microsoft TypeScript package is `@microsoft/tiktokenizer@1.0.10`, MIT. Official OpenAI cl100k/o200k ranks are downloaded only by `npm --prefix maxim/app run prepare:tokenizers` (also run by build/tests), bounded to 5 MiB each and checked against pinned SHA-256 values. Runtime counting never downloads a vocabulary or transmits candidate text.

References: [Microsoft TypeScript guide](https://github.com/microsoft/Tokenizer/blob/main/tokenizer_ts/README.md), [OpenAI encoding hashes](https://github.com/openai/tiktoken/blob/main/tiktoken_ext/openai_public.py), [OpenAI model mapping](https://github.com/openai/tiktoken/blob/main/tiktoken/model.py).

Model profiles explicitly cover GPT-4o/mini, GPT-4.1/mini/nano, GPT-5/mini/nano and their dated snapshots with o200k, plus a bounded legacy GPT-4/cl100k profile. This is tokenizer/request policy, not proof of account availability, current pricing or model quality. Unknown aliases/encodings fail before transmission rather than being guessed. A synthetic fixture-model alias exists only in test mode. For a simple non-reasoning demo, choose an accessible documented tool-capable model in Settings; account access remains yours.

Every chat call counts the complete serialized request: system instructions, all tool schemas, ordered recent history, current input, retrieved evidence and tool results. Hard limits:
- 32,000 serialized UTF-8 bytes.
- Default 8,192 local total-token policy, including output reserve; a smaller protected runtime contextBudget is supported.
- Actual BPE count plus 25% margin and explicit framing allowance (512 + 16/message + 64/tool).
- 1,024 output tokens per chat call; four model rounds, three calls/round and 60-second run deadline.
- Model-window/byte upper-bound guard; oversized mandatory context is refused, not silently trimmed.
- History is bounded to 12 saved user/assistant messages and is never promoted to approved facts by summarization.
- Consented source interpretation uses the same full-request compiler, a 1,600-token output reserve and its existing 20-second deadline. Context failure preserves local extraction with a warning.

Local serialization/framing counts are **not exact provider billing**. Runs save each local accounting record and separately reported provider usage. Missing usage is unreported, never estimated as actual. Context accounting is inspectable under the agent transcript. Real BPE token vectors, Unicode/ordinary special text, unsupported models, tiny-budget refusal and captured fixture requests are tested. A live-provider quality/billing calibration is not claimed.

## Revisions, Erasure And History

PostgreSQL migration 004 owns exact questions, answer current rows/version snapshots, fact references, dependencies and actual reuse records. Candidate authority remains S2's; application/tracker ownership remains S5's.

Correction/revocation and dependent-draft invalidation commit in one authorized command transaction with idempotency/event/outbox records. Question/answer snapshots and fact revisions are checked again, not trusted because the model once saw them. Source deletion erases dependent answer/current-version copies and source-derived chat content. Retention defaults to 180 days (1-365 configurable) and excludes expired rows immediately; worker maintenance physically redacts expired current memory in bounded batches.

Submitted use snapshots are historical and are not silently rewritten by correction or current-answer deletion. S3 has no submission endpoint; the submitted-history integration fixture only proves this immutable policy for the S5 handoff.

Opaque audit IDs, revisions and hashes remain. Old private backups/cutover journals follow explicit owner retention and are not silently altered. No plaintext source/answer values are included in metadata-only events. Keep exports/backups private; do not attach them to recruiter/project documentation.

## Boundaries

S3 does not apply to sites, log in, send outreach or submit. Browser assistance is S6. New approved packets/evaluation/tracker migration are S5. No LinkedIn/Gmail/Discord account is needed for local memory. A model key is optional for chat; manual question/answer/review/reuse remains usable without it.

`npm --prefix maxim/app test` runs real local Rust/tokenizer/parser/build/integration/browser checks with disposable databases and synthetic identities. It does not use repository .env or production data as test fallback.

