# Start And Use Maxim Apply

Updated: 2026-11-19. Canonical folder: `D:\VSC Programs\maxim-apply`.
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

## Continue A Saved Application

For sorting scanned jobs and distinguishing evaluated fit from search matches,
see [Scanning, fit scores and ranking](job-scoring.md). Jobs shows current scores
in its list and details and defaults to highest first. Discovery keyword/location
matches are not fit scores.

Open [Applications](http://127.0.0.1:3010/maxim?view=applications) and select the
role. An intent is a local record, not a submitted application.

1. **Review candidate knowledge.** Existing confirmed facts can be used without
   re-uploading your resume. In Candidate, inspect the fields, open **Career-Ops
   authority -> Review cutover**, review the four exact projections and activate
   only if you approve the ownership change. Legacy application migration is
   separate and is not required for evaluating a saved role.
2. **Configure evaluation model.** In Settings, enter an OpenAI API key and a
   model available to your API project. **Load models** retrieves account-visible
   IDs using the entered or stored key without saving it; manual exact-ID entry
   also works. **Save connection** stores settings locally.
   **Check model access** checks the provider's model endpoint without sending
   your profile, a posting, or an evaluation. Saved does not mean verified.
   Neither listing nor access checking proves task compatibility. New connections
   use Responses; existing connections retain Chat Completions. Use **Advanced
   connection** to change API explicitly; there is no automatic paid fallback.
3. **Evaluate with Career-Ops**, review its report and approve an exact current
   packet. Choose **Open Apply Assistant** from that application. Confirm site
   and private-field consent yourself. A role conversation accepts **Evaluate
   this role** or **Fill approved fields** when the scoped action is permitted.
4. For an unknown field, **Save question** opens the exact question in Answers.
   Record and approve your answer, then **Return to Apply Assistant** and review
   the exact reuse. Take manual control, submit yourself, and record what happened.

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
   [Setup and local-role filters](discovery.md).
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

## Model Selection And Compatibility

Settings no longer restricts model names to a fixed list. Use an exact API ID,
not a display name such as `GPT-6.1 Terra`. Select from **Load models**, or enter
the ID manually if the key lacks model-list permissions. The list may include
specialized models that cannot perform text, JSON or function-calling tasks.
The provider determines actual access and capability; failures remain explicit.
Changing model/API does not silently retry queued work or switch providers.

Chat, retained Career-Ops scoring, consented source interpretation and interview
feedback share the saved connection. Responses supports stateless text, JSON and
scoped function calls. Existing Chat Completions connections remain usable; saving
without an explicit API through the HTTP endpoint defaults to Responses.
Unknown IDs use an explicitly estimated local token counter with existing byte,
input and output budgets. Their actual context windows are not guessed. A new
model can still reject a task, require more output budget, or be unavailable to
the account. No incomplete evaluation or refusal becomes a completed score.

Credentials remain in the protected local runtime. All model requests explicitly
set `store:false`; reasoning continuation is replayed only in memory during the
current tool loop, not saved into reusable facts or hosted conversations. Listing
and checking access send no candidate/posting contents or generation prompts.
There is no automatic billable compatibility test. OpenAI API access is required;
Anthropic credentials are not supported by this connection.

## Backup, Restore And Problems

For disk usage, safe cleanup and test/browser locations, see
[Storage maintenance](storage-maintenance.md). Docker recovery and host-side
cleanup are implemented; this does not promote the remaining MVP acceptance gates.

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
