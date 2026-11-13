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
- COMPLETE: Account-free LinkedIn/person discovery commands exist through `npm run maxim:linkedin-find`.
- PARTIAL: Store-backed networking shortlist and draft creation are implemented. Higher-quality ready-to-send drafts still benefit from user-approved person/company research notes or prior outreach examples before large batches are persisted.
- PARTIAL: Historical tracker/source workbook exists locally, but real outcome analytics need user-reviewed import/interpretation.
- COMPLETE: Basic real Career-Ops artifact path is proven with one BLEN report, generated PDF, tracker row, sync, dashboard snapshot, and operational readiness pass.
- PARTIAL: Candidate email, phone, LinkedIn, and optional private address fields must stay in local `.env` or ignored `config/profile.yml` before guided browser assist can fill real contact/address fields. Optional env keys: `MAXIM_CANDIDATE_STREET_ADDRESS`, `MAXIM_CANDIDATE_CITY`, `MAXIM_CANDIDATE_STATE`, `MAXIM_CANDIDATE_POSTAL_CODE`, `MAXIM_CANDIDATE_COUNTRY`.
- PARTIAL: Application outcomes/interview rounds still need real rows before analytics can guide strategy.
- Prior application-answer examples for approved answer memory.
- Prior outreach examples approved as style baselines.
- Optional person-specific networking research notes for highest-priority contacts.
- Optional pasted public/LinkedIn people-search result snippets in `data/maxim/linkedin_people_results.txt`.

## Templates Now Available

- `data/maxim/templates/contacts.example.csv`
- `data/maxim/templates/target_companies.example.csv`
- `data/maxim/templates/application_outcomes.example.csv`
- `data/maxim/templates/evidence_claims.example.yml`
- `data/maxim/templates/linkedin_people_results.example.txt`
- `data/maxim/templates/prior_outreach_examples.example.md`

Copy these to private local files before entering real personal data. Do not commit private contacts, tracker rows, recruiter notes, webhook URLs, or sensitive evidence.

## Policy Choices Still Manual

- Optional demographic/self-identification answer behavior.
- Contract-role toggle for daily use.
- Personal email workflows that should be tracked externally.
- Whether any future semi-automated application executor should be designed after v1 data proves the bottleneck.
