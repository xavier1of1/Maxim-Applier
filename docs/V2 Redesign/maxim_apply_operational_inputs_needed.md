# Maxim Apply Operational Inputs Needed

This file tracks what Xavier needs to provide before Maxim Apply can become fully operational.

## Accounts and Secrets

- Discord webhook URL for accountability notifications (`MAXIM_DISCORD_WEBHOOK_URL`).
- Dedicated application Gmail account connection details if managed inbox automation is enabled later.
- Any Career-Ops upstream repository remote or artifact locations if this repo is not the full fork root.

## User Data

- Approved source resume/CV content for Career-Ops user-layer configuration. A local evidence-gated `cv.md` scaffold exists, but detailed claims are intentionally pending.
- Approved evidence bank for resume claims, metrics, tools, Wabtec restrictions, and portfolio links.
- Target company list. A starter local `portals.yml` exists, but it should be reviewed and expanded.
- Contact list with optional Subjective Connection Strength Rating 1-3.
- Historical tracker file for import. CSV and XLSX are supported; raw copies are preserved under ignored local Maxim import storage.
- Prior application-answer examples for approved answer memory.
- Prior outreach examples approved as style baselines.

## Templates Now Available

- `data/maxim/templates/contacts.example.csv`
- `data/maxim/templates/target_companies.example.csv`
- `data/maxim/templates/application_outcomes.example.csv`
- `data/maxim/templates/evidence_claims.example.yml`
- `data/maxim/templates/prior_outreach_examples.example.md`

Copy these to private local files before entering real personal data. Do not commit private contacts, tracker rows, recruiter notes, webhook URLs, or sensitive evidence.

## Policy Choices Still Manual

- Optional demographic/self-identification answer behavior.
- Contract-role toggle for daily use.
- Personal email workflows that should be tracked externally.
- Whether any future semi-automated application executor should be designed after v1 data proves the bottleneck.
