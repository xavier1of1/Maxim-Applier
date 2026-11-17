# S0 Runtime, Storage, And Compatibility Decision

Status: Selected for S1 implementation, 2026-11-16. No new application deployed.

## Runtime

Use one Next.js/React TypeScript workspace at maxim/app with server-only domain services.
Retain existing MJS scoring/policy/parser/provider/PDF capabilities behind narrow adapters.
Use PostgreSQL repositories through pg and reviewed SQL migrations, not a copied Dossier schema.
Official npm metadata resolved Next 16.4.6 (Node >=20.9), React 19.3.1 and pg 8.23.1 (Node >=16).
Next peer metadata accepts React ^19.0.0. Pin react-dom to the matching React version after
its registry check at S1 installation; resolve TypeScript/test-tool versions then.
The current Node 20.15.1 runs the baseline tests. S1 must select a maintained Node runtime
and lock all dependencies before deployment; this is not certification of an installed web stack.

Web, worker and headed browser run on the interactive Windows host; PostgreSQL uses
loopback-only Compose. There is no Linux-container-to-desktop bridge assumption.
S1 adds local bootstrap/session authentication, CSRF/origin checks and workspace scope.
S2 creates the first consumed extraction worker; later consumers reuse its leases.

## Model And Knowledge

Select one server-side OpenAI-compatible provider adapter with explicit configured model ID,
credential reference, endpoint allowlist and request/output limits. No guessed model default.
Scripted loopback protocol fixtures are mandatory; a live key is not needed for S0.
Do not adopt Microsoft Tokenizer for an unverified model encoding. S1 must declare a supported
counter or explicit conservative estimate/refusal mode; S3 validates complete request accounting.
Model replies never approve candidate facts or confirm their own mutations.

## Storage And Recovery

Use LOCALAPPDATA/MaximApply/private as the private host root. The directory was provisioned
with inheritance removed and current-user/SYSTEM full-control ACLs. This is access control,
not encryption or protection from a compromised user account.
Keep live artifacts, backups and recoveries in separate children; DB container volumes are
selected and restore-tested in S1. Credentials stay separately protected; .env is not in
the S0 snapshot. Never place this root in a Git or public build context.

The backup library snapshots SQLite through its backup API and checks integrity, rejects
WAL-present coordinated snapshots and source changes, hashes all payloads, refuses overlap,
existing restore targets and path traversal. Stop writers before coordinated snapshots.
No destructive restore into live paths. Retain the pre-cutover snapshot through reconciliation;
production backup retention/encryption/off-device policy must be fixed before cutover.

## Compatibility And Licenses

Native data contracts remain active. S2 gates candidate writers; S5 gates application writers;
S9 adapts contacts/history. Review upstream changes on a separate branch with scoped regression
tests; do not run generic updater replacements over fork decisions or user data.
No scoring/PDF rewrite, no competing score, no final application submission, no LinkedIn sending.
Dossier behavior is independently implemented by default; copying its AGPL source requires
a separate explicit licensing decision. Astryx and agent-browser remain compatibility spikes.
No Hermes or runtime Graphify dependency. No new runtime dependency was installed by S0.
