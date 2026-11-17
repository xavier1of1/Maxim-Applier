# ADR 0010: Retained Evaluation And Application Ownership

Date: 2026-11-17. Status: Accepted for S5 implementation; production cutover remains
an explicit reviewed operation.

## Decision

Keep Career-Ops modes, the shared evaluation prompt, scoring and native Chromium/
LaTeX generators. Add narrow server adapters, not the old URL-fetch/mtime/merge/sync
CLI chain. PostgreSQL owns versioned evaluation/packet/application state only after
an owner-reviewed application-family cutover, independently of candidate ownership.
Use Rust for strict report/score/policy/GFM normalization and TypeScript for the
existing authenticated API, durable work, filesystem/model/generator orchestration.

## Boundaries

- Invocation-specific context, leases, private output and hashes prevent cross-job
  selection/replay. The model assesses fit; Rust validates/routes that retained score.
- PDF candidate text is escaped approved evidence, not unchecked generated claims.
  Exact current report/PDF/fact/answer bindings require human approval.
- Workflow and outcome are distinct. Manual external submissions are legitimate
  declarations with unknown/unverified packet state retained honestly.
- Raw legacy files/SQLite types/history/artifacts stay separate from normalization.
  Exact source-key maps preserve S1 identities; ambiguous mappings require review.
- Freeze supported writers, compare raw/projection hashes, commit DB ownership
  before publication, and recover from latest committed state. Pre-commit recovery
  never restores an old baseline over acknowledged native edits.
- Rollback exports current canonical application state while preserving unrelated
  SQLite families; canonical writes then require a reviewed re-cutover.
- Native/Go compatibility uses hash-bound as-of projections and explicit write
  rejection. No no-op success or stale SQLite fallback is permitted.
- Retire rejected planner/mapper/browser registrations/imports and archive obsolete
  instructions. Keep useful safety scenarios for S6 and private historical reports.

## Consequences

The same IDs/commands drive web, agent and CLI. Bounded exports can fail/freeze and
need explicit recovery; raw captures/journals/backups retain private historical
evidence. Users review real sources/packets and still submit manually.
S6 browser, S7 Gmail, S8 delivery and S9 contact/history analytics are not implied.

See [operator and compatibility guide](../application-lifecycle.md) and
[S5 acceptance evidence](../../../roadmap/reviews/s5-evaluation-and-cutover.md).
