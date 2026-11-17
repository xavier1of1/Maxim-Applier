# Maxim Apply Workspace

Updated: 2026-11-17. This is the new local workspace, not the rejected legacy Maxim browser runner.

## Start And Sign In

Prerequisites: Windows, npm, Docker Desktop's Linux engine running, Rust 1.76+ with the MSVC build toolchain, network for initial packages/images/crates. The app installs pinned Node 24 locally; it does not replace host Node or upgrade Rust globally.

~~~powershell
cd "D:\VSC Programs\maxim-apply"
npm run maxim:workspace:install
npm run maxim:workspace:build
npm run maxim:workspace:setup
npm run maxim:workspace
~~~

The launcher prints the real URL, preferably **http://127.0.0.1:3010/maxim**. It selects a free loopback port on conflict and only reuses a server whose installation marker matches. Old ports 3000/8000 are not this app.

Reveal the local sign-in key in your own terminal, never in chat or screenshots:

~~~powershell
npm run maxim:workspace:key
~~~

Sign in with that key. Sessions are opaque HttpOnly, SameSite=Strict cookies with a 12-hour expiry; only their hashes are stored. Sign out under Settings. This is single-user local authentication, not public-hosting or enterprise identity.

Daily start/stop:

~~~powershell
npm run maxim:workspace
npm run maxim:workspace:stop
~~~

Start owns both web and durable worker processes. Stop verifies their recorded command lines before stopping them, stops only this Compose database and retains data. Do not use docker compose down -v.

## User Workflow

Candidate is the reviewed onboarding workspace: upload authorized PDF/DOCX/MD/TXT sources,
review exact proposals, confirm/correct individual facts, choose disclosure and explicitly
activate candidate authority only after reviewing native projections. See
[Reviewed onboarding](reviewed-onboarding.md) for the full workflow, limits and recovery.
This is independent of the reference uploads attached to individual jobs below.

1. Jobs -> New role: save the actual company/title/JD, optional location and HTTPS posting URL. A UUID/revision is persisted without a model key.
2. Create intent: persist an intention to apply, not a submitted application. Repeating cannot duplicate the intent for that role.
3. Save a Working note. Revision checks prevent stale-tab overwrites; unsaved drafts are guarded during navigation.
4. Upload PDF/TXT/MD references up to 10 MB. These are private hash-checked references, not approved resumes or extracted facts.
5. Applications lists intents; Activity lists events. Archive/restore roles and intents without deleting history.
6. Select a role and open Agent. Wide desktop shows it alongside the record; smaller screens use a separate dialog. Role/view/conversation IDs survive refresh in the URL. No private records are saved in browser localStorage.
7. With a model configured, ask "What roles have I saved?" or "Read this role and propose a note reminding me to research the team."
8. Review the exact proposed target, note and revision, then Confirm update or Reject. Only a completed run's proposal can be confirmed, within ten minutes, in its original session and against the unchanged revision.
9. Saved conversations include ordered tool messages and failure/cancel outcomes. Stop cancels a run. Expired abandoned leases recover as interrupted, not completed.

Empty data is genuinely empty. Failed refreshes label last-loaded data and disable mutations; there are no sample-job fallbacks.

## Model Configuration And Privacy

Settings -> Model connection accepts an OpenAI model ID and API key. Choose a model your own project can access that supports Chat Completions, streaming and strict tools. Billing/access is your account's responsibility. Blank replacement-key input preserves the stored key.

Secrets remain in the protected runtime file, not public settings, bundles, Git or model messages. Chat sends bounded recent messages, selected IDs and authorized tool data to the provider. Job-reference bytes are not interpreted. Candidate sources are parsed locally; minimized model interpretation and future candidate context require explicit source permission. Private/sensitive fields remain withheld from general model context. Do not put prohibited proprietary material in chat, sources, notes or JDs.

Tools: read_workspace, get_job, propose_job_note, read_candidate_context, propose_candidate_fact. No shell, SQL, arbitrary file access, submit, send, fact approval or confirm tool exists. Conversation prose is not candidate truth; exact declaration proposals require Candidate review. Missing evaluations remain unknown; no competing score is generated.

S3 adds the [Answers workspace](answer-memory.md), filtered answer recall, exact-declaration
drafts and extractive drafts from reviewed facts. Approval, disclosure and actual reuse
remain separate human decisions. Current question/answer IDs and revisions survive restart.

Limits: 32,000 UTF-8 serialized request bytes including policy/history/tools/results; local 8,192-token total policy including framing/margin and 1,024 output reserve; four model rounds; three tool calls per round; 60-second run deadline. Microsoft Tokenizer counts pinned local vocabularies. Oversize mandatory context and unknown model profiles fail explicitly. Local BPE/framing estimates are not exact provider billing; saved runs show local accounting and separately reported provider usage.

Manual records work without a key. The isolated fixture model proves plumbing, not live access/model quality. No live provider smoke was performed.

## Storage And Authority

| Data | Location |
| --- | --- |
| New workspace/jobs/intents/conversations/commands/events/outbox/artifact metadata | PostgreSQL 18.1, maxim_workspace, named maxim-workspace Compose volume |
| DB listener | 127.0.0.1:55432 preferred, free port chosen/stored on conflict |
| Runtime credentials/settings | %LOCALAPPDATA%\MaximApply\private\workspace\runtime.json |
| Immutable uploaded bytes | Protected workspace artifacts directory, opaque UUID keys |
| Web/worker PID/ownership/logs | Protected workspace server.json/server.log and worker.json/worker.log |
| Backups/recoveries | Protected workspace backups and recoveries directories |
| Source/lock | maxim/app, maxim/db/postgres, compose.yml, app package-lock.json |
| Candidate | Legacy until explicit S2 activation; then reviewed PostgreSQL facts and native read projections |
| Tracker/SQLite | Existing Career-Ops authority until separate S5 cutover |

Setup removes inherited private-directory ACL access and grants the current user and SYSTEM. This is not encryption or protection against administrators, malware or the same Windows account. Docker volume security follows Docker Desktop.

MAXIM_RUNTIME_FILE is an advanced server-side runtime-file selector. Normal startup uses the generated protected file. Never select untrusted/test config for production. No DATABASE_URL or provider key is required in repository .env; legacy scripts remain independent.

Read snapshots are repeatable-read and scoped. Domain commands reauthorize inside transactions; changes, idempotency results, events and outbox commit together. The outbox has no dispatcher yet. Authentication lifecycle and private model-credential rotation are administrative operations, not candidate/job commands. No cross-store atomicity with legacy SQLite/JSONL is claimed.

## Backup And Recovery

With Docker running:

~~~powershell
npm run maxim:workspace:backup
npm run maxim:workspace:restore -- workspace-REPLACE_WITH_PRINTED_ID
~~~

Backup prints its ID and copies a PostgreSQL snapshot, every live referenced immutable file and known candidate cutover journals with hashes. Uploads/purge/cutover coordinate with its lock. Only complete backups receive a version-2 final manifest; restore also supports S1 version 1. Runtime credentials are excluded, but dumps still contain private conversations and authentication hashes.

Restore verifies manifest, hashes, paths and restored artifact metadata. It creates a new maxim_restore_<timestamp> database and separate recoveries artifact/cutover files. It never overwrites or silently promotes the live database. Tests read restored IDs/revisions, reference bytes and candidate cutover journals.

Use only trusted local backups. Preserve the protected runtime configuration separately. Off-device restoration needs credentials and an explicitly reviewed activation procedure. This is verified isolated recovery, not automatic live replacement, encryption, off-device redundancy or retention/expiry management. Do not delete the active volume after a restore proof.

## Tests

~~~powershell
npm run maxim:workspace:build
npm --prefix maxim/app exec -- playwright install chromium
npm run maxim:workspace:test
node maxim/scripts/website-safety-check.mjs
node roadmap/validate-roadmap.mjs
node --test roadmap/validate-roadmap.test.mjs
~~~

The suite boots the production build against disposable PostgreSQL, maxim_test_* DBs, maxim-test-* temporary storage, two identities and a loopback scripted model. It never falls back to .env or production credentials. Docker, the production build and Playwright Chromium are required.

Coverage includes intake/replay, rollback, revision checks, scoped actual tool paths, proposal expiry/rejection/confirmation, self-confirmation denial, malformed/truncated/cancelled/disconnected streams, budget, private files, restart/restore, DB outage, desktop/mobile/keyboard and empty/unconfigured states.

Ignored screenshots/traces/reports contain synthetic fixtures only. Do not enable traces against production personal records. Legacy tests remain separate, with known failures explicitly recorded in the acceptance evidence.

## Troubleshooting

- Docker unavailable: start its Linux engine, rerun setup/start. Never replace missing data with samples.
- Wrong port/origin: use the printed URL. localhost and 127.0.0.1 are not interchangeable origins.
- Expired session: sign in, then request a new proposal; an old session's proposal cannot be confirmed.
- Model rejection: check model access/key/billing. Manual records stay usable.
- DB outage: restore connectivity, Refresh workspace, review current state before retry.
- Revision conflict: refresh and review current values instead of overwriting.
- Startup failure: build first, inspect protected server.log locally. Do not publish runtime.json or private logs.
- Saved PID mismatch: stop refuses unrelated processes. Inspect ownership rather than killing arbitrary listeners.

## Boundaries

Candidate onboarding/extraction, reusable answers, discovery, Career-Ops evaluation/tracker cutover, application-browser execution, Gmail and Discord delivery are later stages. Integration controls are disabled, not simulated. The native Career-Ops engine/Go dashboard remain available; no legacy records are automatically imported or replaced.
