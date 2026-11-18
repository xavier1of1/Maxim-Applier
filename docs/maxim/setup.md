# Start And Use Maxim Apply

Updated: 2026-11-17. Canonical folder: `D:\VSC Programs\maxim-apply`.
Do not reopen the deprecated maxim-applier folder to run this product.

## First Start Or Updated Build

Requires Windows, npm, Docker Desktop Linux engine, Rust 1.76+/MSVC and Python 3
(bounded CSV/XLSX/ZIP history/contact parsing). Packages pin Node 24.22.3 locally.
Keep at least 10 GB free on Docker's actual disk as well as room for private data.

~~~powershell
cd "D:\VSC Programs\maxim-apply"
npm run maxim:workspace:install
npm run maxim:workspace:build
Push-Location maxim/app
./node_modules/node/bin/node.exe node_modules/agent-browser/bin/agent-browser.js install
Pop-Location
npm run maxim:workspace
npm run maxim:workspace:key
~~~

Open the printed URL, normally **http://127.0.0.1:3010/maxim**. The key command
prints a secret locally: do not include it in chat, Git or screen sharing.
Daily use needs only `npm run maxim:workspace`; stop with
`npm run maxim:workspace:stop`. Stop retains the database and closes only owned
web/worker/browser processes. It does not delete Docker volumes.

The current build must pass the final verification record before describing it
as fully accepted. An unresponsive Docker engine cannot be replaced with demo
records. See [verification](../../roadmap/reviews/mvp-completion-verification.md).

## Your Actual Journey

1. **Candidate:** import authorized sources, review facts and disclosure. Existing
   staged information is not active just because it was imported. Review the
   authority preview and explicitly activate it. Correct a fact here, not in
   generated Career-Ops projections. [Onboarding](reviewed-onboarding.md).
2. **Settings:** add a supported OpenAI model/key for evaluation and conversation.
   The key stays in protected runtime storage. Manual records do not need a key.
   Candidate professional-fact disclosure is separate from contact/private data.
3. **Discovery or Jobs:** configure public company board sources and terms, search,
   inspect coverage/errors and save roles; or paste a real job manually. Searching
   does not evaluate fit. A company feed cannot guarantee all jobs on the internet.
4. **Applications:** create intent, review location/salary/clearance policy,
   evaluate with Career-Ops, inspect retained 1.0-5.0 score/tier, select approved
   evidence and build/review/approve the exact report and PDF. Reconcile any legacy
   tracker before activating application authority. [Lifecycle](application-lifecycle.md).
5. **Answers:** capture novel questions, draft from actual evidence/declarations,
   approve exact text and define company/reuse/disclosure scope. Confirmation of
   each exact reuse remains separate. Corrections invalidate stale uses.
6. **Apply Assistant:** authorize the dedicated visible browser; fill approved
   fields/PDF; resolve unknowns through Answers; pause/resume/re-inspect; explicitly
   take manual control. Only you submit. Record actual submission afterwards.
   [Browser support and limits](browser-assistance.md).
7. **Gmail (optional):** create the private Desktop OAuth client, select a mailbox
   and up to five threads, approve read-only access and check selected threads.
   Review links/tasks; email alone never declares an application outcome.
   [Google setup and revocation](gmail.md).
8. **Discord (optional):** privately configure your existing maxim applier webhook
   and channel, preview aggregates, approve exact categories and enable delivery.
   Configure schedules separately. No new bot/server is necessary. Uncertain
   delivery is not blindly retried. [Destination and schedules](discord.md).
9. **Networking:** import authorized contacts/history or enter manual records,
   review identities, shortlist for eligible roles, supply person-specific research,
   select supported background facts and review five-part outreach drafts. Send
   manually and record replies/referrals/follow-ups. Analytics uses reviewed
   submitted attempts, with unknown/excluded/small/immature cohorts explained.
   [Networking workflow](networking-workspace.md).
10. **Interview practice:** select a saved role, choose project defense, STAR or
    hypothetical design, inspect selected approved evidence and save local attempts.
    Model feedback is optional and separately consented per attempt. Practice does
    not become a candidate fact or reusable answer. [Practice](interview-practice.md).

## Backup, Restore And Problems

~~~powershell
npm run maxim:workspace:backup
npm run maxim:workspace:restore -- workspace-REPLACE_WITH_BACKUP_ID
~~~

Backups include private database/artifact content but exclude credentials. Restore
creates an isolated recovery database/files; it never silently replaces live state.
Keep runtime/Gmail/Discord credential files protected and back them up separately.
See [storage, recovery and troubleshooting](workspace.md).

If Docker hangs or C: fills, stop test runs, free disk on Docker's actual drive and
restore Docker Desktop health. Never run broad prune, delete the active volume,
or edit private runtime JSON to fake availability. Rerun the complete tests after
recovery. Isolated fixture TEMP may be placed on an external D: directory, never
inside the repository; production private-root guards remain active.
