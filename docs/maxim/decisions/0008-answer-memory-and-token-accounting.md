# ADR 0008: Versioned Answer Reuse And Local Token Accounting

Status: Implemented for S3, 2026-11-17.

## Decision

Keep exact question/context, answer revision, supporting fact revisions, approval, reuse permission, disclosure, sensitivity, expiry and actual use as separate PostgreSQL records. Retrieval is deterministic: exact typed fact first, current-company approved answers next, then explicitly compatible same-candidate cross-company answers. Related tags provide review history, not automatic semantic permission.

Use the Rust domain boundary for conservative question classification and exact standard-field aliases. Do not infer work authorization from citizenship or turn missing booleans into false. Special questions retain application-specific/manual policy.

Use the user's suggested Microsoft TypeScript tokenizer, pinned to 1.0.10, with checksum-verified official rank assets prepared ahead of runtime. No .NET service, global model installation or speculative tokenizer mapping is needed. Count complete serialized calls, add explicit framing/margin/output reserve and retain provider usage separately. Unsupported encodings/models refuse honestly.

## Consequences

Source/fact/answer correction or revocation invalidates future uses atomically. Live run checks prevent invalidated evidence from reaching subsequent model calls, not just later conversations. Stored drafts do not acquire approval/disclosure because a model produced them. Extractive drafts from reviewed facts avoid retyping while preserving exact evidence; novel unsupported claims still require a direct user declaration and review.

Submitted immutable snapshots remain history. Current deletion erases current copies/contexts and source-derived chat records; backups have explicit separate owner retention. Bounded lexical lookup and recent UI coverage are disclosed instead of pretending to search all history semantically.

No vector service, competing candidate profile, legacy auto-applier reuse, model self-confirmation or browser executor is introduced. See answer-memory.md and roadmap/reviews/s3-answer-memory.md for behavior and evidence.

