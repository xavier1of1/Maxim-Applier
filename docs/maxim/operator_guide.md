# Maxim Apply Operator Guide

Last updated: 2026-06-03

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

Career-Ops remains the evaluator. Paste a job URL/JD into your agent workflow or use the native Career-Ops evaluation flow. Outputs should land in:

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

```powershell
npm run maxim:networking -- path\to\job.json path\to\contacts.json
npm run maxim:message-drafts -- path\to\draft-payload.json
```

Xavier sends LinkedIn/email messages manually. Maxim only ranks, drafts, queues, and tracks statuses.

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
