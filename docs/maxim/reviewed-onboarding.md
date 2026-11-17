# Reviewed Candidate Onboarding

Updated: 2026-11-17. This guide describes the implemented S2 workspace, not the old auto-apply runner.

## Start And Review

1. Run `npm run maxim:workspace:build` after pulling implementation changes, then `npm run maxim:workspace`. Docker Desktop must be running. The launcher starts the local web server, database and durable worker. The preferred URL is http://127.0.0.1:3010/maxim; use the actual printed URL.
2. Reveal your own access key using `npm run maxim:workspace:key`, sign in, and open Candidate. Never paste the key into chat or Git.
3. Open Sources. Choose authorized personal/public material, a raw retention period (1-365 days; default 30) and whether to allow minimized model interpretation. Consent is off by default. Upload PDF, DOCX, UTF-8 Markdown or text.
4. Source state moves from queued/running to review required or failed. Worker unavailable means work is still durable, not complete. Refresh can resume the bounded UI polling window.
5. Open Review proposals. Inspect the source quotation and exact value. Reject incorrect interpretations. Confirm accurate fields individually; a different existing value or changed revision requires explicit conflict replacement.
6. Use Add fact for manual declarations, including fields the parser missed. Unknown booleans stay unknown until you explicitly choose Yes or No. Correct/withdraw fields from Confirmed knowledge; stale tabs cannot overwrite newer revisions.
7. Open Career-Ops authority. Import native sources only if desired. Importing stages sources and proposals; it never approves their claims, enables disclosure or switches ownership.
8. After reviewing facts, choose Review cutover. Inspect all four exact projections and the candidate revision. Only then activate. No personal files are activated by installing or testing the system.

## Input Support And Limits

| Input | Implemented behavior | Explicit boundary |
| --- | --- | --- |
| PDF | PDF.js 6.5.438, local standard fonts, text extraction | 10 MB, 30 pages, 50,000 extracted characters; no OCR guarantee; encrypted/active/unreadable/blank sources fail safely |
| DOCX | yauzl preflight and Mammoth raw-text extraction | 500 entries, 30 MB expanded, 100:1 entry ratio with 1 KB floor; encrypted archives, traversal, macros, embedded executables, external entities and altChunk are refused |
| MD/TXT | Fatal UTF-8 decode and plain-text treatment | 10 MB / 50,000 characters; no HTML/script execution, NULs refused |
| Native profile YAML | Explicit owner-only import of fixed config/profile.yml | JSON-schema YAML, bounded traversal, primitive/list fields only; not a general upload type |

Parsing runs in a child process with 256 MB JS heap, 20-second deadline and bounded output. Rust 1.76-compatible validation enforces primitive types, approved field namespaces and non-downgradable sensitivity. It never approves facts. Extraction considers at most 500 lines, 100 validation attempts and 50 local proposals plus at most 20 model proposals; full allowed text remains available for local review. A partial-coverage warning is not a claim that the whole resume was understood.

Local extraction recognizes explicit tagged fields, contact URLs/email, conservative name lines and quoted evidence paragraphs. It does not invent job histories, dates or achievements. Scanned files need user-supplied text. Supported format does not mean every layout is semantically understood.

## Disclosure And Personal Data

Classification and model permission are separate. Restricted employer material is refused at intake; known restricted markers also fail before interpretation. This is a guardrail, not a complete proprietary-content classifier: submit only material you are authorized to use.

No model key is needed for extraction/manual review. With explicit permission and a configured model, interpretation sends at most 10,000 minimized characters with contact/number/token redaction, bounded output and a 20-second deadline. Returned facts require exact source quotations and remain proposals. A permission revocation cannot recall a request already transmitted; it cancels queued work, fences publication and invalidates future contexts.

Future model/native projection reuse requires both current fact approval and source disclosure permission. Standard fields only enter general candidate model context; email/phone/address/authorization fields are private and voluntary self-ID is sensitive. These remain inspectable locally but withheld from general model/native projections. Do not enable disclosure just to make a score look populated.

The agent can read approved disclosable context and propose a fact from an exact current declaration. It cannot approve facts. Review candidate facts opens the same human review view. Conversation prose is not memory truth, and undisclosed/invalidated source-dependent history is excluded from future model prompts.

## Storage, Identity And Worker

- Metadata, proposals, current facts, immutable fact revisions, dependency records, commands/events and work leases live in PostgreSQL.
- Private source bytes use opaque UUID artifact keys outside Git. Downloads require the correct workspace session and verify hashes/paths.
- Source content hash deduplicates within a workspace. Re-upload cannot silently broaden permission. Deleted source reintroduction gets a new content revision.
- A job claim uses PostgreSQL SKIP LOCKED and a fenced lease/token. Two workers may run, but only the current lease may publish. Three attempts maximum; cancellation/lost leases never approve facts.
- Sources, proposals, facts and cutovers are workspace-scoped. Only the installation owner can write native projections or import fixed native files.
- Worker ownership/logs are in the protected workspace worker.json/worker.log. Start/stop verifies process identity before stopping owned processes. No startup task or recurring external notification was installed.

## Candidate Cutover And Recovery

The marker is `data/maxim/authority.json`, not a second profile. No marker means legacy. A corrupt marker fails closed.

| State | Current writer | Native use |
| --- | --- | --- |
| Legacy / staged | Native candidate files; workspace facts are staging | Existing behavior; review workspace changes before activation |
| Frozen | No native candidate writer/evaluation | Recover the exact interrupted transition; never edit the marker to bypass it |
| Canonical | Reviewed PostgreSQL candidate service | Hash/revision-checked, consent-filtered generated projections; offline/stale/tampered context is rejected |

The four projections are `cv.md`, `config/profile.yml`, `modes/_profile.md` and `article-digest.md`. Native instructions and Gemini evaluation call the authority gate. User-specific facts never enter system prompts/templates in Git. Direct manual filesystem edits are not prevented by an OS sandbox, but invalidate hash checks and cannot silently become approved context.

Prepare stores original bytes, projection bytes, hashes and revision privately. Activate requires an unchanged baseline and exact prepared revision, freezes writes, publishes files and commits the owner. A post-commit projection acknowledgment makes the marker current. Crash between filesystem/DB operations remains frozen; Recover projections reconciles it. Arbitrary additional native edits are refused, not discarded.

Corrections enqueue a real projection refresh. Native evaluation refuses a stale revision until refresh completes; Recover projections can explicitly rebuild it. Paths with linked/junction escape are rejected.

Rollback deliberately returns file write ownership with the **latest permitted approved projection**, not an older profile that would lose acknowledged corrections. Full acknowledged facts (including fields withheld from model context) and original baseline bytes are preserved in protected cutover journals for reconciliation. Legacy owners may then edit files; reactivation requires a new reviewed transition. Tracker ownership is a separate S5 operation.

## Retention, Erasure And Backup

Raw retention expires source text, pending/rejected proposal values/quotes and raw artifacts, but keeps individually confirmed facts and their provenance. Maintenance processes 20 expired sources per idle maintenance cycle. Failed/dead work remains diagnosable. Retention is not proof that already transmitted provider requests have been deleted by the provider.

Delete source withdraws and erases current source facts, its proposal values/quotes and source fact-version values; invalidates derived contexts; redacts dependent chat runs; scrubs the display name; denies downloads immediately; queues idempotent physical file purge. Reintroduced sources do not revive old approval. Metadata-only events/IDs and hashes are retained for audit. Historical submitted artifacts, when introduced in S5, are separate immutable records.

Existing private backups and cutover journals are **not silently rewritten** by source deletion. They remain private recovery snapshots until the owner explicitly removes the chosen protected snapshot after reviewing recovery obligations. No automatic backup expiry policy is installed.

`npm run maxim:workspace:backup` now creates a version-2 manifest containing the PostgreSQL dump, live referenced artifact bytes and known candidate cutover journals, with hashes and path validation. Restore still accepts S1 version-1 backups. `npm run maxim:workspace:restore -- <backup-id>` creates a separate recovery database and artifact/cutover tree, never silently promotes it. Keep runtime credentials separately protected. A restore proof is not an automatic off-device backup or production activation.

## Verification

`npm --prefix maxim/app test` runs Rust, parser tests, typecheck/build, real disposable PostgreSQL/HTTP/worker integration and production Chromium UI tests. Requires Docker, pinned local Node and Playwright Chromium. It never falls back to production credentials or personal sources.

Actual cases and their environments are recorded in `roadmap/reviews/s2-onboarding.md`. Fixture model tests prove authorization/protocol/revisions, not live model quality, account access, OCR or universal resume understanding.

