# Maxim Apply Operational Inputs Needed

This file tracks what Xavier needs to provide before Maxim Apply can become fully operational.

## Accounts and Secrets

- COMPLETE: Discord webhook URL for accountability notifications (`MAXIM_DISCORD_WEBHOOK_URL`) exists in local `.env`; live notification validation completed without exposing the value.
- OPTIONAL FUTURE: Dedicated application Gmail account connection details if managed inbox automation is enabled later.
- COMPLETE: Career-Ops upstream remote is configured for this fork.

## User Data

- PARTIAL: Approved source resume/CV content exists locally under raw imports and `article-digest.md`, but claims still need user approval before generated materials rely on them.
- PARTIAL: Approved evidence bank for resume claims, metrics, tools, Wabtec restrictions, and portfolio links still needs review/approval.
- COMPLETE: Target company data exists locally and imports through `npm run maxim:import-target-companies`.
- PARTIAL: Imported target-company/source preferences still need user review before strategic use.
- COMPLETE: Contact list with Subjective Connection Strength Rating 1-3 exists and imports through `npm run maxim:import-contacts`.
- PARTIAL: Historical tracker/source workbook exists locally, but real outcome analytics need user-reviewed import/interpretation.
- COMPLETE: Basic real Career-Ops artifact path is proven with one BLEN report, generated PDF, tracker row, sync, dashboard snapshot, and operational readiness pass.
- PARTIAL: Application outcomes/interview rounds still need real rows before analytics can guide strategy.
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
