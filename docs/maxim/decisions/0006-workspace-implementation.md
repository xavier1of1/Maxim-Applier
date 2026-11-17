# ADR 0006: Workspace Implementation

Date: 2026-11-16. Status: implemented; acceptance evidence lives in the workspace review.
Builds on [ADR 0005](0005-s0-runtime-storage-and-compatibility.md).

## Runtime And Interface

One Next.js 16.4.6 / React 19.3.1 / TypeScript application lives in maxim/app.
Pinned local Node 24.22.3 avoids replacing host Node. PostgreSQL 18.1 runs in
loopback-only Compose; the web process runs on Windows. Its normal port is 3010.
Source-only tracing excludes protected runtime files, legacy user data and tests.

Meta Astryx 0.7.16 core and neutral theme, StyleX 0.19.2 and Lucide supply the
component/icon foundation. Astryx styles are imported in reset/core/theme order.
No Dossier AGPL source or orchestration framework was copied.

## Ownership And Transactions

The new workspace is intentionally isolated from legacy Career-Ops files/SQLite.
Manual records have stable UUIDs; a role has at most one application intent.
This is not submission history or a legacy tracker cutover. Source aliases are
reserved by schema; automatic ingestion and canonical duplicate resolution come later.

HTTP and model proposals share scoped services and transaction primitives.
Domain mutations persist state, payload-bound idempotency results, events and
outbox rows together. Expected revisions and actor scope are checked at commit.
PostgreSQL composite foreign keys also enforce workspace relationships.
The outbox is not consumed until a real downstream worker is introduced.

Authentication/session lifecycle, runtime credential rotation and expired-lease
recovery are administrative lifecycle operations, not job/candidate commands.
Model settings are atomic protected-file replacement, not a falsely claimed
cross-filesystem/PostgreSQL transaction. They cannot change candidate facts.

## Trust And Model Boundary

Opaque local sessions, exact Origin/Host and session-bound CSRF guard writes.
The model can read bounded role/application/activity data and propose a note.
A distinct human request confirms the exact proposal/revision in the original
session. It cannot self-confirm, call SQL/shell or choose another workspace.

OpenAI Chat Completions is the first server adapter. Model and key are explicit
local setup, not hardcoded account assumptions. Conservative request-byte limits
plus output/round/time caps exist now. Exact model-specific token accounting is
not claimed; provider-reported usage is summed with coverage counts.
The fixture adapter is loopback-only and allowed only in isolated test mode.

## Files And Recovery

PDF/TXT/MD references are immutable, bounded, scoped, hash-checked and downloaded
as attachments. They are not parsed, approved candidate evidence or application
attachments. Raw host paths and storage keys are never public read fields.
Secrets live outside source in a current-user/SYSTEM protected runtime directory.

Backups coordinate with uploads through a PostgreSQL advisory lock; dumps and
referenced file hashes form a final manifest. Restore creates isolated recovery
DB/files, verifies metadata and leaves active originals untouched. It does not
claim encrypted/off-device disaster recovery or automatic live promotion.

## Consequences

Manual work remains useful without a model key. Empty/error/unconfigured states
remain truthful. The actual production HTTP/DB/browser harness is separate from
legacy recursive tests and cannot select production credentials as fallback.
Later onboarding, discovery, evaluation and browser stages extend this app;
they must not silently activate a second candidate/tracker authority.
