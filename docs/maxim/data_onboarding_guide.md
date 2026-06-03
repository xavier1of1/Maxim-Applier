# Maxim Apply Data Onboarding Guide

Last updated: 2026-06-03

This guide moves Maxim Apply from fixture-validated to operationally useful. Keep all real personal data local unless Xavier intentionally decides otherwise.

## 1. Approved Evidence And Resume Claims

Result: Career-Ops and Maxim can draft materials without fabricating claims.

1. Copy `data/maxim/templates/evidence_claims.example.yml` to a local, ignored evidence file such as `data/maxim/evidence_claims.yml`.
2. Add only approved claims, evidence sources, allowed uses, and restricted contexts.
3. Add or update `article-digest.md` with approved public proof points if available.
4. Keep Wabtec internal/proprietary details out of public or generated distributable materials.
5. Run:

```powershell
npm run maxim:doctor
```

Expected result: the evidence warning should disappear once a real approved evidence source exists.

## 2. Career-Ops Evaluations And PDFs

Result: `maxim:sync` ingests nonzero evaluations and links reports/PDFs.

1. Use native Career-Ops to evaluate real roles and generate reports under `reports/`.
2. Generate tailored PDFs under `output/` using Career-Ops PDF flow.
3. Keep `data/applications.md` updated through native Career-Ops tracker scripts.
4. Run:

```powershell
npm run verify
npm run maxim:sync
npm run maxim:dashboard-state
```

Expected result: `maxim:sync` reports one or more evaluations, and `maxim:dashboard-state` shows nonzero job/application counts when eligible records exist.

## 3. Historical Tracker

Result: raw history is preserved and normalized records become available for analytics.

1. Put the real tracker `.xlsx` or `.csv` somewhere local and private.
2. Run:

```powershell
npm run maxim:import-history -- "path\to\historical-tracker.xlsx"
```

Expected result: a raw copy appears under `data/maxim/imports/raw/`, normalized output appears under `data/maxim/imports/normalized/`, and the import report lists row counts, issues, and interview-signal derivation.

## 4. Contacts And Target Companies

Result: T2/T3 jobs can produce ranked people shortlists and ready-to-send manual drafts.

1. Copy `data/maxim/templates/contacts.example.csv` to a local private contacts file.
2. Fill in real contacts with company, name, title, LinkedIn URL, notes, connection strength 1-3, and optional VT/recruiter/founder signals.
3. Copy `data/maxim/templates/target_companies.example.csv` to a local private target-company file.
4. Convert contacts to JSON before running the current shortlist script, or use the template as a source for a future importer.
5. Run:

```powershell
npm run maxim:networking -- "path\to\job.json" "path\to\contacts.json"
npm run maxim:message-drafts -- "path\to\draft-payload.json"
```

Expected result: no LinkedIn message is sent. Drafts are stored as `ready_to_send` for Xavier to send manually.

## 5. Application Outcomes

Result: analytics can compute the NoVA/DC interview-rate KPI with real denominators.

1. Copy `data/maxim/templates/application_outcomes.example.csv` to a local private outcomes file.
2. Fill in real outcomes after Xavier manually submits or receives responses.
3. Prefer linking outcomes back to Career-Ops report/PDF paths and Maxim application IDs.
4. Run:

```powershell
npm run maxim:analytics
```

Expected result: analytics shows NoVA/DC-compatible denominator, interview-rate percentage, breakdowns, and small-sample warnings when data is still thin.

## 6. Discord

Result: urgent fresh T2+ jobs, ready-message batches, and recruiter response reminders can notify Xavier.

1. Create a Discord webhook in the target server/channel.
2. Set it only in the local environment:

```powershell
$env:MAXIM_DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

3. Run dry-run first:

```powershell
npm run maxim:notify
```

4. For a live send, use the direct script only after reviewing planned notifications:

```powershell
node maxim/scripts/discord-notify.mjs
```

Expected result: no webhook value is committed. Duplicate suppression prevents already-recorded fingerprints from being resent.

## 7. Dashboard

Result: Maxim mode displays operational state inside the Career-Ops dashboard.

1. Refresh the dashboard snapshot:

```powershell
npm run maxim:dashboard-state
```

2. Start the native dashboard:

```powershell
cd dashboard
go run . -path ..
```

3. Press `m` from the Career-Ops pipeline to enter Maxim Apply mode.

Expected result: Today, High Conviction, Networking, Recruiter Inbox, Applications, Analytics, and Settings render without crashing. Empty states should be useful when real data is missing.
