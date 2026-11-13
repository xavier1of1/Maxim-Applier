# Maxim Networking Validation

Last updated: 2026-06-10

## Status

COMPLETE for fixture data, real local contact import, LinkedIn/person discovery planning, pasted result parsing, store-backed shortlist dry-run, manual draft creation, and manual status tracking. LinkedIn login, scraping, and sending remain intentionally unimplemented.

## Commands Run

```powershell
npm run maxim:networking -- maxim\tests\fixtures\networking-job.json maxim\tests\fixtures\networking-contacts.json --no-store
npm run maxim:message-drafts -- maxim\tests\fixtures\message-draft-payload.json --no-store
npm run maxim:linkedin-find -- --company "Federal Platform Labs" --role "Software Engineer, Mission Systems" --results maxim\tests\fixtures\linkedin-people-results.txt --no-store
npm run maxim:import-contacts -- data\maxim\contacts.csv --no-store
npm run maxim:import-contacts -- data\maxim\contacts.csv
node --test maxim\tests\unit\contact-ranker.test.mjs maxim\tests\unit\message-builder.test.mjs maxim\tests\integration\networking-store.test.mjs maxim\tests\integration\dashboard-snapshot.test.mjs
npm run maxim:networking -- --from-store --drafts --no-store --limit-jobs 2 --limit-contacts 2
npm run maxim:networking -- --from-store --drafts --require-research --no-store --limit-jobs 1 --limit-contacts 1
npm run maxim:message-drafts -- list --status ready_to_send
```

## LinkedIn Finder Proof

`maxim:linkedin-find` now supports account-free discovery:

- Generates manual public search URLs for recruiter, hiring manager, peer, VT alumni, and founder/startup targets.
- Parses pasted public/LinkedIn people-result snippets into contact candidates.
- Combines parsed contacts with the local contact store.
- Can store parsed contacts with `--store-results`.
- Can queue job-specific networking targets with `--queue`.
- Does not log in, scrape authenticated pages, or send messages.

Fixture validation parsed three people-result blocks:

- Technical recruiter at the target company.
- Engineering manager with a Virginia Tech signal.
- Founder/startup contact with role-lane relevance.

## Fixture Ranking Proof

The fixture shortlist produced:

- Top rank score: `88`
- Ranking reasons:
  - Same company
  - Connection strength 2
  - Recruiter or talent role
  - Role-lane relevance

The second fixture contact validated:

- Connection strength 1
- Virginia Tech signal
- Role-lane relevance

## Real Contact Import Proof

The real local `data/maxim/contacts.csv` file parsed and imported into the ignored local SQLite store:

- Parsed contacts: 747
- Imported contacts: 747
- Skipped contacts: 0
- Contacts with connection strength: 747
- VT alumni signals: 99
- Recruiter signals: 20
- Founder/startup signals: 26

One row contained malformed Unicode. The importer and SQLite bridge were hardened to strip invalid surrogate code units before persistence.

## Message Structure Proof

The draft validator confirms every draft includes:

1. Person research.
2. Role reference.
3. Xavier background.
4. Fit rationale.
5. Call to action.

The draft channel is `linkedin_manual`; no function sends LinkedIn messages.

## Store-Backed Queue Proof

The store-backed dry run read the local SQLite store without writing targets or drafts:

- Jobs considered: 2
- Contacts considered: 816
- Ranked manual-only draft candidates: 4
- Stored targets: 0
- Stored drafts: 0

Integration tests also prove persisted store-backed targets/drafts are idempotent. When a draft is marked `sent_manually`, rerunning shortlist generation preserves that manual status instead of resetting it to `ready_to_send`.

## Research-Gated Draft Proof

Networking now has a local research-note model. Notes are attached to a networking target, job, and contact, then used by `maxim:message-drafts -- from-target <target_id> --require-research`.

The focused integration test proves:

- a target-specific draft is blocked when `--require-research` is set and no approved research note exists,
- a manual research note can be stored locally,
- the resulting draft includes that research text,
- the dashboard networking queue exposes the research-note ID and draft status,
- no LinkedIn or email send function exists.

The store-backed research-gated dry run also returned a warning instead of creating a draft when no approved note was available.

Manual statuses supported by `maxim:message-drafts`:

- `ready_to_send`
- `sent_manually`
- `replied`
- `follow_up_due`
- `referral_asked`
- `referred`
- `declined`
- `no_response`

The ranker was tightened so unrelated contacts do not receive role-lane points just because the job title contains "software" or "engineer"; the contact must carry a matching relevance signal too.

## Remaining Operational Need

The normalized LinkedIn export also exists locally, but its field shape is less directly useful for ranking than `data/maxim/contacts.csv`. Use `maxim:import-contacts` as the operational contact ingestion path.

Add person-specific research notes before persisting large batches of drafts when the generic contact/company context is not enough for a high-quality message. The safest high-quality path is:

```powershell
npm run maxim:networking -- --from-store --limit-jobs 5 --limit-contacts 3
npm run maxim:message-drafts -- research <target_id> --text "Approved research note"
npm run maxim:message-drafts -- from-target <target_id> --require-research
```
