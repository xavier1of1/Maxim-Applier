# S0 Baseline And Acceptance Evidence

Date: 2026-11-16. Scope: current local fork, safe fixture tests and protected recovery.
Planning baseline commit 51fb34e was pushed before this work. No production cutover occurred.

## OWN-01: Source And Ownership Map

Canonical source is D:/VSC Programs/maxim-apply, feature branch maxim/v2-career-ops-fork.
Origin remains xavier1of1/Maxim-Applier; upstream santifer/career-ops.
Bounded inspection: repository package manifests and Compose files, native dashboard,
known sibling obsolete folder and package commands. Only native root package/Go module
were found; separately reported web ports 3000/8000 remain source-unlocated.

| Authority | Current readers/writers | Required transition |
| --- | --- | --- |
| cv.md, config/profile.yml, modes/_profile.md, article-digest.md | AGENTS/CLAUDE onboarding and customization; evaluation/PDF modes and profile loader | S2 reviewed import, compatible projections, gate every direct profile write |
| portals.yml | native scanner and source audit | S4 provider isolation/run provenance; no accidental native pipeline write |
| data/applications.md, pipeline.md, scan-history.tsv | scan, merge, normalize, dedup, evaluation wrapper and tracker modes | S5 canonical writer switch, stable legacy key map and rollback |
| SQLite data/maxim/maxim.db | createStore callers across Maxim CLIs | S2/S5/S9 per-entity migration; never treat Python calls as one transaction |
| JSONL events | EventLog/SQLite appendAuditEvent | S1 atomic DB event authority; derived exports only after cutover |
| reports/output/jds | evaluator, PDF/liveness, parsers and dashboard | retain generators, per-invocation artifact identity and approved hashes |
| Go dashboard | native data reader and Maxim snapshot reader; RecordDecision no-op | S5 real command or explicit refusal, labeled stale projections |
| contacts/history/recruiter/drafts | import/networking/message/recruiter CLI store writers | S9 raw-preserving migration and manual status retention |
| notifications | Discord CLI writes fingerprint before POST | S8 acceptance/retry/outbox replacement; do not claim scheduling now |

## OWN-02: Actual Recovery Proof

Created and restored a protected private snapshot: **137 files, 11,934,685 bytes**.
All 137 restored payload hashes verified. Originals were not overwritten.
SQLite used its backup API and integrity check; source-change/WAL checks prevent claiming
a coordinated live-writer snapshot. .env excluded. Location reference:
LOCALAPPDATA/MaximApply/private/backups and recoveries, never Git.
ACL provisioning succeeded with current-user/SYSTEM access and inheritance removed.
This is a same-disk recovery copy, not encrypted/off-device disaster recovery.

Six fixture tests pass: byte/raw-field/ID/artifact-link preservation, repeat restore,
production/ancestor/existing-target refusal, corrupt/missing payload, traversal, no overwrite.
Command: node --test maxim/tests/integration/baseline-restore.test.mjs
Windows Temp realpath checks required permitted filesystem access; initial EPERM was environmental.

Repeat with node maxim/scripts/baseline-backup.mjs create, then
node maxim/scripts/baseline-backup.mjs restore <backup-id>.
The private directory ACL must be provisioned/verified before use; the CLI does not certify it.
Only new restore directories are supported. Reconcile in isolation; never copy back blindly.

## OWN-03: Architecture Binding

Selected runtime/storage/local-access/license decisions are recorded in
[ADR 0005](../../docs/maxim/decisions/0005-s0-runtime-storage-and-compatibility.md).
Registry metadata was queried without installing packages. Remaining version-resolution
steps are explicit S1 installation gates, not claims of running services.

## OWN-04: Patch And Retirement Inventory

| Entry points | Owner / treatment / regression / rollback |
| --- | --- |
| AGENTS.md, CLAUDE.md, personalization modes | S2 writer gates and projections; fact-revision/cutover tests; restore old owner before reverting guidance |
| merge-tracker.mjs, normalize-statuses.mjs, dedup-tracker.mjs, tracker/auto-pipeline modes | S5 gate/adapt writes; raw mapping/dedup/status rollback tests; retain legacy files read-only |
| scan.mjs/providers, liveness-core/check-liveness | S4 isolated adapter, S5 writer coordination; source/pacing/liveness fixtures; native CLI retained until switch |
| generate-pdf/generate-latex/cv-sync-check and templates | S5 retain capabilities with private context/invocation output; PDF/path/version tests; no generator rewrite |
| maxim:evaluate-job, gemini:eval | S5 invocation-bound evaluator, no newest-mtime selection; concurrent/malformed-result tests; retain old route only before approved cutover |
| maxim:sync, tier, dashboard-state, analytics, operational, doctor | S5/S9 migrate consumers; doctor may initialize store, so not read-only; stale/denial/projection tests |
| maxim:application, apply-workflow | S5 canonical commands/identity; duplicate/reapply/action snapshot tests; freeze legacy writes during rollback |
| maxim:auto-apply, maxim:auto-apply-browser; planner/mapper/browser reports | S5 retire registrations/imports/docs after data preservation; S6 reuses safety scenarios, not algorithm |
| maxim:import-history/contacts/target-companies, linkedin-find, networking, message-drafts, recruiter-inbox | S9 retain/adapt store writes and useful pure ranking/parsing; manual history/research/privacy tests |
| maxim:notify | S8 repair/gate premature fingerprints; loopback 429/unknown-outcome/retry tests |
| npm update/rollback/check, update-system.mjs | S0 manually reviewed upstream boundary; no update applied; separate merge branch and retained user-layer backups |
| test-all.mjs, maxim:test/e2e, Go tests | S0 isolated fixtures only; full native runner mutates trackers, so not run against personal data |
| safety/alignment/verify tooling | retain intent; adapt obsolete ownership assertions only alongside proved cutover |

No rejected entry point was deleted in S0; no supported native behavior was rewritten.
Any new writer discovered during S1-S9 must be added before that entity family's cutover.

## OWN-05: Bounded Privacy Audit

Reviewed changed/untracked file paths before commit; known credential patterns found no
matches in the 32-file worktree. This is not a guarantee against all secret formats.
Tracked/history path audit found 11 sensitive-name matches, consisting of example/fixture
CV/profile/tracker files and system pipeline mode files, not root .env or live DB paths.
No full historical blob-content clean claim is made.

Two existing tracked work-product paths require private content classification before further
distribution: an operational export and a story-bank document. No contents or contact/secret
values are included here. Ignore rules do not remove those tracked files or their history.
No automatic deletion, rotation or history rewriting was performed. Review/remediate under a
separate approved procedure if private/proprietary content is confirmed. Before S1 image/export
publishing, enforce an explicit source-only build allowlist and protected private data root.

## OWN-06: Baseline And Failure Owners

Executed this stage: recovery 6/6 pass; native unit 53/55 pass (same two failures);
Go dashboard tests pass; static website safety passes. Roadmap checks are run at closeout.
Full test-all omitted because it normalizes/deduplicates/merges real trackers.
Update check returned offline; no upstream update applied.

Known failures remain owned: source-audit --help -> S4; unapproved fallback attachment -> S5/S6;
Discord retry -> S8 (reproduced in preceding validation, not a real Discord send).
Additional code-inspected risks: no-op Go decisions, non-atomic SQLite/JSONL, fuzzy opening
identity, invalid score coercion and incorrect interview-rate denominator -> S1/S5/S9.
No live model, Gmail, browser application or Discord action was taken.

## Handoff

S0 is verified for the bounded foundation scope, not a privacy-clean-history certification or
a deployed stack. S1 can implement the recorded app/auth/storage contracts. Before production
cutover take a fresh quiescent backup, fix retention/encryption, and pass the consuming stage's
tests. Existing user-file and SQLite authorities remain active until their specific gates.
