# S2-S5 Execution Record

Started: 2026-11-17. Initial branch maxim/v2-career-ops-fork clean at ef7d698.
Each stage is a separate tested commit; merge to main only after S2-S5 acceptance.

| Stage | Status |
| --- | --- |
| S2 reviewed onboarding | Verified; commit 63556f9 |
| S3 answer memory | Verified; commit 232a0ab |
| S4 discovery | Verified; separate commit being recorded |
| S5 evaluator/tracker cutover | Pending |

C: initially had only about 260 MB free; a command setup failed with disk-full.
The user freed space; C: had about 9.2 GB available on recheck. No personal files were deleted.
New npm downloads use an ignored app-local cache on D:.

## S2 Verified

- Rust 1.76-compatible typed-fact validation and retained score-band routing: 8 unit cases.
- Real PDF/DOCX/MD/TXT extraction: 6 parser/security unit cases.
- Final full app suite: 8 Rust, 6 parser, 32 integration TAP cases and 8 Chromium workflows passed.
- This run caught and fixed JSON-key-order-dependent cutover hash comparison.
- Production Next/Astryx build and TypeScript checks pass; private native paths excluded from build tracing.
- Crash-before-publication, revoked-history exclusion, coordinated journal restore and responsive onboarding UI passed.
- Go dashboard, static platform safety and native evaluator help passed.
- See roadmap/reviews/s2-onboarding.md for case-level evidence and deliberate boundaries.

## S3 Verified

- Versioned exact-context questions, reviewed answers, fact references and reuse drafts are implemented.
- Rust conservative question policy and local Microsoft tokenizer are integrated.
- Final full suite passed: 14 Rust, 10 unit, 42 integration TAP cases and 10 Chromium workflows.
- In-flight revocation, exact extractive drafting, cancelled-origin approval refusal, DB/web restart and source/answer erasure are covered.
- Static platform safety passed. See roadmap/reviews/s3-answer-memory.md for case evidence.

Use the detailed stage contracts. Imports never approve personal facts or activate authority.
Fixtures prove supported paths, not real model quality or universal ATS support.

## S4 Verified

Retained Greenhouse/Lever/Ashby mapping, hardened public GET transport, revisioned
query/source lineage, raw observations/aliases, checkpointed durable work and
Search/History/Saved/Dismissed/Source Health UI are implemented. Rust owns policy,
not fit assessment. See roadmap/reviews/s4-discovery.md for case evidence and the
dated one-board public smoke (59 postings, 43 engineering matches, one real GET).
Final full suite: 23 Rust, 12 unit, 50 integration TAP cases and 12 Chromium workflows
pass. Native audit/CLI safety, Go dashboard and static platform safety pass.
