# Maxim Apply Setup Guide

Last updated: 2026-06-03

## First-Time Setup

```powershell
cd "d:\VSC Programs\maxim-apply"
npm install
npx playwright install chromium
npm run doctor
npm run maxim:doctor
```

## Local User Layer

These files are intentionally ignored by git and stay local:

- `cv.md`
- `config/profile.yml`
- `modes/_profile.md`
- `portals.yml`
- `data/applications.md`

The current local `cv.md` is evidence-gated. Add approved resume evidence before trusting generated application materials.

## Daily Commands

```powershell
npm run maxim:sync
npm run maxim:dashboard-state
npm run maxim:analytics
npm run maxim:notify
```

Use these as needed:

```powershell
npm run maxim:tier -- --score 4.6 --location "Arlington, VA" --salary "$95,000 - $125,000"
npm run maxim:import-history -- path\to\historical-tracker.xlsx
npm run maxim:networking -- path\to\job.json path\to\contacts.json
npm run maxim:message-drafts -- path\to\draft-payload.json
npm run maxim:recruiter-inbox -- create "Recruiter reply" "Company"
npm run maxim:application -- create career_ops_evaluation_id
```

## Dashboard

```powershell
cd "d:\VSC Programs\maxim-apply"
npm run maxim:dashboard-state
cd dashboard
go run . -path ..
```

Press `m` from the Career-Ops pipeline to enter Maxim Apply mode.

## Secrets

Live Discord sends require:

```powershell
$env:MAXIM_DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

Never commit `.env` or webhook values.
