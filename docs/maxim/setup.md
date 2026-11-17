# Maxim Apply Setup Guide

## November 2026 Workspace

Use the [new workspace guide](workspace.md) for the authenticated Astryx dashboard,
PostgreSQL, agent, private files, startup/stop and recovery. Preferred URL:
http://127.0.0.1:3010/maxim (the launcher prints the actual port).
The older instructions below describe the retained legacy system, not the new workspace.

Last updated: 2026-06-04

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

## Data Templates

Example-only onboarding templates live in `data/maxim/templates/`:

- `contacts.example.csv`
- `target_companies.example.csv`
- `application_outcomes.example.csv`
- `evidence_claims.example.yml`
- `prior_outreach_examples.example.md`

Copy templates to private local files before adding real contacts, evidence, outcomes, or outreach examples.

## Daily Commands

```powershell
npm run maxim:evaluate-job -- "https://jobs.example.com/posting/123"
npm run maxim:sync
npm run maxim:import-contacts -- data\maxim\contacts.csv --no-store
npm run maxim:import-contacts -- data\maxim\contacts.csv
npm run maxim:import-target-companies -- data\maxim\target_companies.csv --no-store
npm run maxim:import-target-companies -- data\maxim\target_companies.csv
npm run maxim:linkedin-find -- --from-store --limit-jobs 5
npm run maxim:networking -- --from-store --drafts --no-store --limit-jobs 5 --limit-contacts 3
npm run maxim:networking -- --from-store --drafts --require-research --no-store --limit-jobs 5 --limit-contacts 3
npm run maxim:apply-workflow
npm run maxim:auto-apply -- prepare --ready-only
npm run maxim:auto-apply -- plan --ready-only
npm run maxim:dashboard-state
npm run maxim:analytics
npm run maxim:operational
npm run maxim:notify
```

Use these as needed:

```powershell
npm run maxim:tier -- --score 4.6 --location "Arlington, VA" --salary "$95,000 - $125,000"
npm run maxim:evaluate-job -- path\to\saved-jd.txt
npm run maxim:import-history -- path\to\historical-tracker.xlsx
npm run maxim:import-contacts -- path\to\contacts.csv
npm run maxim:import-target-companies -- path\to\target_companies.csv
npm run maxim:linkedin-find -- --company "Target Company" --role "Target Role"
npm run maxim:linkedin-find -- --company "Target Company" --role "Target Role" --results data\maxim\linkedin_people_results.txt --store-results
npm run maxim:networking -- --from-store --limit-jobs 5 --limit-contacts 3
npm run maxim:message-drafts -- research target_id --text "Approved research note"
npm run maxim:message-drafts -- from-target target_id --require-research
npm run maxim:networking -- --from-store --drafts --limit-jobs 5 --limit-contacts 3
npm run maxim:message-drafts -- list --status ready_to_send
npm run maxim:message-drafts -- status draft_id sent_manually
npm run maxim:networking -- path\to\job.json path\to\contacts.json
npm run maxim:message-drafts -- path\to\draft-payload.json
npm run maxim:recruiter-inbox -- create "Recruiter reply" "Company"
npm run maxim:application -- create career_ops_evaluation_id
npm run maxim:auto-apply -- plan-one application_id
npm run maxim:auto-apply-browser -- inspect application_id
npm run maxim:auto-apply-browser -- assist application_id
npm run maxim:auto-apply-browser -- assist application_id --write-report
```

Guided browser assist requires complete local contact answers in `config/profile.yml`:

- `candidate.email`
- `candidate.phone`
- `candidate.linkedin` when portals require LinkedIn
- optional private address fields: `candidate.street_address`, `candidate.city`, `candidate.state`, `candidate.postal_code`, `candidate.country`
- optional `application_answers.relocation.open_to_relocating`
- optional `application_answers.communication.sms_consent`

You can also keep these in ignored `.env` instead of `config/profile.yml`:

```powershell
MAXIM_CANDIDATE_EMAIL=you@example.com
MAXIM_CANDIDATE_PHONE=555-0100
MAXIM_CANDIDATE_LINKEDIN=https://www.linkedin.com/in/your-profile
MAXIM_CANDIDATE_STREET_ADDRESS=123 Local Street
MAXIM_CANDIDATE_CITY=Arlington
MAXIM_CANDIDATE_STATE=VA
MAXIM_CANDIDATE_POSTAL_CODE=22201
MAXIM_CANDIDATE_COUNTRY=United States
MAXIM_RELOCATION_OPEN=yes
MAXIM_SMS_CONSENT=no
```

Check readiness without printing the values:

```powershell
npm run maxim:auto-apply -- doctor
```

## Dashboard

```powershell
cd "d:\VSC Programs\maxim-apply"
npm run maxim:dashboard-state
cd dashboard
go run . -path ..
```

Press `m` from the Career-Ops pipeline to enter Maxim Apply mode.

Manual dashboard smoke-test steps are documented in `docs/maxim/testing/dashboard-smoke-test.md`.

## Secrets

Live Discord sends require `MAXIM_DISCORD_WEBHOOK_URL`. The notifier loads `.env` automatically for direct live sends:

```powershell
node maxim/scripts/discord-notify.mjs
```

Never commit `.env` or webhook values.
