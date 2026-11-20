# Evaluation, Packets And Application Tracking

Updated: 2026-11-17. Implemented S5 workflow. See
[workspace startup](workspace.md), [candidate onboarding](reviewed-onboarding.md),
[answer memory](answer-memory.md) and [discovery](discovery.md).

## 1. Start With Reviewed Knowledge

Run `npm run maxim:workspace` and open the URL printed by the launcher, normally
http://127.0.0.1:3010/maxim. Get your local sign-in key with
`npm run maxim:workspace:key` in your own terminal.

In Candidate, upload authorized PDF/DOCX/MD/TXT sources or record individual facts.
Review every proposed fact, correct errors, choose disclosure and explicitly
activate candidate authority after reviewing its projections. A file upload,
conversation, reference attachment or legacy import is not approved knowledge.
Only current standard facts whose sources permit model use enter evaluation.
Private facts can be explicitly selected for a local PDF; sensitive facts cannot.
Keep employer-proprietary information and secrets out of all sources.

Settings accepts your OpenAI API key and an exact model ID, with account-visible
selection through Load models and manual entry retained. New connections use
Responses; existing connections retain Chat Completions. Evaluation
needs model access; local intake, manual tracking, review and discovery feeds do
not. The existing Gemini CLI uses its own key; configuring it does not configure
this workspace. No real model bill is incurred by deterministic acceptance tests.
Metadata access checks do not certify text/JSON/tool compatibility. Unknown names
are not blocked by a tokenizer whitelist; local estimates and request budgets
remain enforced. Provider/task errors never become a completed evaluation.

## 2. Save The Exact Opening

Use Jobs -> New role, or save a public-feed result in Discovery. Supply the full
job description, company, role, actual location and HTTPS posting URL. Create
intent; this persists one application for that job UUID, not a submission.

Open Applications and select the opening. Its company/title are not its identity:
different source IDs or posting URLs remain distinct. Similar openings raise a
warning and require acknowledgement before packet approval or reapplication.
Records are never fuzzy-merged.

For an imported/manual opening with no full description, expand **Correct manual
posting details**, paste the real description/location and missing URL, and record
why. Revisions and an event preserve attribution. A different existing URL needs
a distinct opening. Discovered source descriptions cannot be silently overwritten.

Review posting policy before evaluation when salary was not supplied structurally.
Enter exact posted amounts/currency/interval and an exact quote from the current
description. Unknown pay is review-needed, not a guessed USD salary. Maryland
requires a reasoned explicit override. Connection/alumni/recruiter/founder/target
signals are priority overlays, never additional fit scores.

## 3. Evaluate With Career-Ops

Click **Evaluate with Career-Ops**, or open a new conversation for the selected
role and ask the Agent:

~~~text
Evaluate this role
~~~

The agent checks the exact current request and its persisted role context. In a
conversation with no selected role, specify the exact job UUID. Staged candidate
authority and a missing supported model have direct review/setup links.
The agent cannot approve facts, packets or submissions.
The same evaluator is available through:

~~~powershell
npm run maxim:evaluate-job -- <job-UUID>
npm run maxim:applications -- list
~~~

Each invocation snapshots approved candidate facts, posting, policy review,
retained mode/prompt/generator hashes, provider/model and context accounting.
Durable work is lease-fenced, bounded to 75 seconds and uses private invocation
directories. Retries never select another job's newest report or delete unrelated
artifacts. Transport does not blindly retry provider failures.

Career-Ops retains the evaluation methodology and 1.0-5.0 score. Rust validates
the complete A-G/H report, exact company/role and score summary, then routes:

| Career-Ops score | Maxim tier | Assisted application |
| --- | --- | --- |
| Below 3.5 | T0 | No Apply |
| 3.5 to below 4.0 | T1 | Explicit, revocable strategic override required |
| 4.0 to below 4.5 | T2 | Subject to policy and packet approval |
| 4.5 to 5.0 | T3 | Subject to policy and packet approval |

Missing, partial, conflicting or invalid scores are unknown/review-required, not
T0 or fabricated fit. The report and explanation remain inspectable. Liveness
is labeled **unconfirmed**; an evaluation is not proof a posting is still open.
Native `check-liveness.mjs` remains available separately.

## 4. Prepare And Approve A Packet

Expand **Prepare PDF packet**. Select exact approved evidence and, if needed,
explicitly permit selected private facts in the local PDF. Mark a role-specific
selection only after actually curating it. Otherwise the resume is explicitly
untailored and requires a second consent at approval.

The retained Chromium generator produces a real Letter PDF from escaped, approved
fact values grouped into readable resume sections. No model-authored candidate
claim is inserted into it. Selected text is verified against the rendered PDF;
placeholders, missing facts and extraction mismatches hold the packet. Native PDF
generation remains available at the retained 3.0 threshold, but T0 cannot approve
an assisted-application packet.

Open both report and PDF. **Review packet** displays candidate/posting revisions,
selected evidence and report/PDF/packet SHA-256 hashes. Confirm the exact bytes,
untailored consent if applicable, duplicate review and a reason. T1 additionally
requires the current override; blocked/unknown location/pay/clearance policy holds
approval. Old reference uploads and historical PDFs never become approved by
existing on disk.

Candidate correction/withdrawal, source consent change, posting/policy correction,
new evaluation, answer revocation/expiry or generator change makes dependent
material stale. Rebuild/review rather than reusing a stale approval.

## 5. Apply Manually And Record Truth

**Open posting** opens the actual website. Complete and submit it yourself.
Native `/career-ops apply` can still assist with reviewed questions in an available
visible browser, but it must obey current candidate/answer authority. S5 does not
provide a new browser executor or promise support for Workday/LinkedIn/Indeed.

- **Record manual start** requires the current approved packet and posting URL.
- **Record form review** records reviewed state; its separate checkbox records an
  actually manually filled form. Preparation alone sets neither.
- **Record submission** confirms an already completed manual submission. Select
  the actual approved packet used, or an external manual submission with no
  unverified packet claim. External submission does not require prior evaluation.
- **Record outcome** records responded/interviewing/offer/rejected/withdrawn/unknown.
  Reversing submission requires an explicit correction.

Submission snapshots retain score/tier/policy and report/PDF hashes at action
time; later edits do not rewrite that history. Unknown stays unknown. Application
history includes actor, reason and separate action-time evidence.

CLI equivalents use the same authenticated local API:

~~~powershell
npm run maxim:applications -- help
npm run maxim:applications -- started <application-UUID> --packet <packet-UUID> --reason "Started manually"
npm run maxim:applications -- submitted <application-UUID> --external --confirmed --reason "Submitted manually on the company site"
npm run maxim:applications -- outcome <application-UUID> responded --reason "Recruiter replied"
~~~

Duplicate/reapplication declarations require `--duplicate-reviewed` when warned.
CLI commands do not click or submit anything on a job website.

## 6. Review Legacy Data Before Switching Ownership

Candidate and application ownership are independent. Startup never imports
personal data, approves facts, erases a pipeline or switches ownership.

Owner-only Applications -> **Legacy migration**:

1. Authorize **Capture native trackers for review**. This reads fixed local native
   paths only; it never fetches an arbitrary URL or follows a linked directory.
2. Inspect/download raw capture JSON and issues. Exact Markdown/TSV/JSONL/history/
   report/PDF bytes and SQLite tables/types are retained separately from normalized
   records. Big integers and BLOBs have lossless tagged representations.
3. Review each paginated record: create a distinct opening, link an exact existing
   job UUID, or preserve raw-only. Choose the actual historical outcome and reason.
   Empty cells, escaped pipes, custom statuses and artifact paths remain raw.
4. A prior source-key mapping must link the same exact opening or stay raw-only;
   it cannot silently create/remap another opening. S1 intent IDs are preserved.
5. Acknowledge source issues and commit the exact reviewed capture hash.
6. **Prepare ownership switch** writes a private journal and preview, staging
   canonical commands. Review counts, identities and projection hash.
7. Confirm **Activate canonical applications**. Existing native write sessions
   must finish; changed source bytes stop activation without losing the edit.
8. Check Applications, native Markdown/JSON/Go reads and revisions. The durable
   projection worker updates compatibility views from the canonical DB.

Repeated identical capture/commit commands are idempotent. Historical artifacts
stay unapproved. Raw statuses/evaluation-at-action are preserved, not promoted to
current fit. Imports make no trend conclusions.

## 7. Recovery And Rollback

**Recover publication** is an explicit, reasoned operation on the current transition.
Before the canonical DB commit it only unfreezes legacy ownership; it cannot
restore an old baseline over a newly acknowledged edit. After the DB commit it
publishes the latest canonical state and hashes, not an old cached preview.

**Roll back ownership** first preserves a private canonical DB-family snapshot,
then exports the latest acknowledged status/IDs/history/artifact links to native
files and upserts the application family into existing SQLite. Unrelated contact,
recruiter/history/raw tables are retained. Repeating recovery finishes publication.
The web application writer stays disabled after rollback until a reviewed new
capture/cutover; it cannot create another writable tracker.

Back up with `npm run maxim:workspace:backup`. Restore only to a new protected
environment using the workspace recovery guide; do not test destructive rollback
on personal data. Raw captures, action history, journals and backups are deliberate
private retention, not erased by deleting an intake source. Submitted evidence is
historical; unsubmitted derived artifacts are purged after source erasure.
Crash-left invocation directories are bounded and cleared after 24 hours only
when their lease is inactive. Unknown files and active leases are preserved.

## 8. Compatibility And Retirement Inventory

| Entry point | After application cutover |
| --- | --- |
| UI / agent / `maxim:applications` | Same scoped PostgreSQL IDs/commands/events |
| `maxim:evaluate-job` | Narrow API adapter; no mtime selection/merge chain |
| `gemini-eval --no-save` | Retained method with current candidate gate |
| Native Gemini save / scanner non-dry-run | Explicit canonical/frozen refusal |
| Merge / normalize / dedup | Explicit refusal before mutation |
| Native batch runner | Cross-process family lease; canonical/frozen refusal |
| PDF / LaTeX | Retained generators; managed reports/output writes gated, private explicit output allowed |
| Go reads/status/decision | Hash-checked canonical read projection; writes explicitly rejected, not a successful no-op |
| `maxim:sync` | Labeled hash-checked offline read, not fresh sync or SQLite rewrite |
| `maxim:dashboard-state` | Reads canonical export; never overwrites it from stale SQLite |
| Doctor / operational | Canonical API availability/readiness, explicit offline failure |
| Legacy analytics / Discord | Refuse stale canonical-family input; S9/S8 adaptation pending |
| Rejected planner / mapper / browser runner | Registrations/imports removed; old script paths fail explicitly |

Legacy ownership retains compatible native behavior. Native offline canonical
reads are labeled revision/as-of and may be stale; writes never fall back.
Generated root/data trackers, reports/PDFs and JSON/JSONL exports are ignored by
Git. The old private browser-run reports are preserved, not deleted.

Application UI uses 50-record pages and exact UUID deep links; recent evaluation/
packet/action history has an explicit 200-record response limit. Raw legacy
record review is paginated. Projection bounds are 10,000 applications, 64 MiB of
artifacts and 50,000 events; exceeding bounds freezes publication with an error
rather than silently truncating a migration.

## 9. Verification And Handoff

`npm run maxim:workspace:test` covers Rust validation, unit logic, real
PostgreSQL/worker concurrency and recovery, actual retained PDF generation and
desktop/mobile Chromium. `npm run maxim:test`, `npm run maxim:safety` and
`go test ./...` under `dashboard` cover retained extensions/native behavior.
Use `npm run maxim:native:test` for the sanitized native full-suite harness and
`npm run maxim:privacy` for cross-platform public-tree/known-secret-copy checks.
The native root full runner mutates trackers: use a sanitized disposable fixture,
never your working personal tracker.

[S5 evidence](../../roadmap/reviews/s5-evaluation-and-cutover.md) records exact
case-level results, environment and limitations. Model responses in automated
tests are deterministic fixtures; this proves integration, not live model quality.
S6 browser filling, S7 Gmail, S8 durable Discord, S9 networking/analytics and S10
interview preparation remain separate stages. No automated application submission,
LinkedIn sending, anti-bot evasion or CAPTCHA bypass exists here.
