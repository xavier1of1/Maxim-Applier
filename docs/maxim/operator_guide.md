# Maxim Apply Operator Guide

Last updated: 2026-06-05

## Start Here

Use the Career-Ops fork folder:

```powershell
cd "d:\VSC Programs\maxim-apply"
```

## Scan

Career-Ops remains the scanner. Run:

```powershell
npm run scan
```

Review generated `data/pipeline.md` entries if present. Do not add hidden automation, CAPTCHA bypassing, or anti-bot evasion.

## Evaluate

Career-Ops remains the evaluator. For normal Maxim use, run the one-command intake wrapper with either a public job URL or a saved JD file:

```powershell
npm run maxim:evaluate-job -- "https://jobs.example.com/posting/123"
```

If URL extraction fails because the page is dynamic or blocks plain HTTP reads, save the JD text locally and run:

```powershell
notepad jds\company-role.txt
npm run maxim:evaluate-job -- jds\company-role.txt
```

The wrapper fetches/saves the JD when possible, runs Gemini evaluation, creates the tracker addition, merges/verifies the tracker, syncs Maxim, refreshes analytics/dashboard state, and checks operational readiness. Outputs should land in:

- `reports/*.md`
- `output/*.pdf`
- `data/applications.md`

Do not fabricate candidate claims. Use approved evidence only.

## Sync

After Career-Ops creates reports/PDFs/tracker rows:

```powershell
npm run verify
npm run maxim:sync
npm run maxim:dashboard-state
```

## View Dashboard

```powershell
cd dashboard
go run . -path ..
```

Press `m` in the native Career-Ops pipeline to enter Maxim Apply mode.

## Interpret Tiers

- `T0`: Career-Ops score below 3.5. No apply / reject.
- `T1`: Score 3.5-3.9. Strategic override only.
- `T2`: Score 4.0-4.4. Qualified apply.
- `T3`: Score 4.5+. High conviction.

Connection, recruiter, VT alumni, founder/startup, and target-company signals are priority overlays, not replacement fit scores.

## Process T3 Roles

1. Open Maxim dashboard.
2. Review Today and High Conviction.
3. Confirm report/PDF readiness.
4. Build networking shortlist if useful.
5. Use Career-Ops apply assistant.
6. Xavier submits manually.
7. Record submitted status:

```powershell
npm run maxim:application -- create <career_ops_evaluation_id>
npm run maxim:application -- submitted <application_id>
```

## Assisted Apply Queue

Maxim can automatically queue eligible synced evaluations for assisted apply, but it does not submit applications.

```powershell
npm run maxim:apply-workflow
npm run maxim:dashboard-state
```

Default queueing includes T2/T3 roles only. T0 is rejected by default, and T1 requires a strategic override. High duplicate-risk roles are held for review. Packet readiness requires both a Career-Ops report and tailored PDF.

Daily assisted apply flow:

```powershell
npm run maxim:auto-apply -- prepare --ready-only
npm run maxim:auto-apply -- plan --ready-only
npm run maxim:application -- started <application_id>
```

For a single application:

```powershell
npm run maxim:auto-apply -- plan-one <application_id>
npm run maxim:auto-apply-browser -- inspect <application_id>
npm run maxim:auto-apply-browser -- assist <application_id>
npm run maxim:auto-apply-browser -- assist <application_id> --record-started
npm run maxim:auto-apply-browser -- assist <application_id> --record-started --write-report
npm run maxim:auto-apply-browser -- assist <application_id> --record-started --write-report --max-steps 4
```

The guided apply plan shows the job URL, report/PDF packet, approved profile answers, review blockers, and stop conditions. Browser inspect/fill can follow safe Apply launchers, map real form fields including embedded iframes and conservative nearby visual labels, fill known-safe fields, match clear dropdown aliases, check explicit matching radio/checkbox choices, validate native typed inputs before fill, and attach the packet PDF through visible or styled hidden upload inputs. It can advance through safe non-final `Next`/`Continue` steps up to `--max-steps`, but it stops for Xavier review before submit/finish/apply controls or any required manual-review field. Individual field failures are reported without aborting the whole run. `--record-started` records only after at least one known-safe field was actually filled on a usable page. Use `--write-report` to save a redacted run report under `data/maxim/auto-apply-runs/`; the report includes a review checklist with required fields, optional fields, failed fields, final controls, stop reasons, and next manual actions. Then open or continue the job page, run `/career-ops apply` for any custom responses, review the generated answers, complete the final application action manually, and record:

```powershell
npm run maxim:application -- submitted <application_id>
```

See `docs/maxim/assisted_apply_workflow.md` for the boundary and safety rules.

## Import Contacts

For local CSV contacts using the Maxim template/schema:

```powershell
npm run maxim:import-contacts -- data\maxim\contacts.csv --no-store
npm run maxim:import-contacts -- data\maxim\contacts.csv
```

Private contact data must stay local and ignored by git.

## Import Target Companies

For local CSV target companies using the Maxim template/schema:

```powershell
npm run maxim:import-target-companies -- data\maxim\target_companies.csv --no-store
npm run maxim:import-target-companies -- data\maxim\target_companies.csv
```

Private target-company data must stay local and ignored by git. These records are source and priority context; they do not replace Career-Ops scoring.

## Build Networking Messages

Dry-run the operational store-backed shortlist first:

```powershell
npm run maxim:networking -- --from-store --drafts --no-store --limit-jobs 5 --limit-contacts 3
npm run maxim:networking -- --from-store --drafts --require-research --no-store --limit-jobs 5 --limit-contacts 3
```

Persist ranked targets after reviewing the dry run:

```powershell
npm run maxim:networking -- --from-store --limit-jobs 5 --limit-contacts 3
```

Add approved person/company research for a target:

```powershell
npm run maxim:message-drafts -- research <target_id> --text "I reviewed their public profile and saw work relevant to this role."
npm run maxim:message-drafts -- research-list --target-id <target_id>
```

Create the manual-only draft from that target and research note:

```powershell
npm run maxim:message-drafts -- from-target <target_id> --require-research
```

You can also persist ranked targets and generic manual-only drafts in one step when research is not required:

```powershell
npm run maxim:networking -- --from-store --drafts --limit-jobs 5 --limit-contacts 3
```

List and update manual draft statuses:

```powershell
npm run maxim:message-drafts -- list --status ready_to_send
npm run maxim:message-drafts -- status <draft_id> sent_manually
npm run maxim:message-drafts -- status <draft_id> replied
```

Fixture or one-off JSON inputs still work:

```powershell
npm run maxim:networking -- path\to\job.json path\to\contacts.json
npm run maxim:message-drafts -- path\to\draft-payload.json
```

Xavier sends LinkedIn/email messages manually. Maxim only ranks, drafts, queues, and tracks statuses. Rerunning the store-backed shortlist preserves manual statuses such as `sent_manually` and `replied`.

## Track Recruiters

Create a manual recruiter thread:

```powershell
npm run maxim:recruiter-inbox -- create "Recruiter follow-up" "Company"
```

List Needs Response:

```powershell
npm run maxim:recruiter-inbox -- needs-response
```

Mark responded:

```powershell
npm run maxim:recruiter-inbox -- responded <thread-id>
```

## Import History

```powershell
npm run maxim:import-history -- path\to\historical-tracker.xlsx
```

Raw imports are preserved under `data/maxim/imports/raw/`; normalized outputs are separate.

## View Analytics

```powershell
npm run maxim:analytics
npm run maxim:dashboard-state
```

The primary KPI is interview rate percentage for NoVA/DC-compatible roles. Treat recommendations as directional until the sample size is large enough.

## Check Operational Readiness

```powershell
npm run maxim:operational
```

Expected result before real Career-Ops artifacts exist: `operationalReady` is `false`, with next actions for reports, PDFs, tracker rows, synced evaluations, and application records. After at least one real role has been evaluated, synced, and tracked, those blockers should clear.

## Notifications

Dry-run:

```powershell
npm run maxim:notify
```

Live send, using `.env`:

```powershell
node maxim/scripts/discord-notify.mjs
```

Never commit webhook values.
