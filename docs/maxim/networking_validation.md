# Maxim Networking Validation

Last updated: 2026-06-03

## Status

COMPLETE for fixture data and real local contact import. LinkedIn sending remains intentionally unimplemented.

## Commands Run

```powershell
npm run maxim:networking -- maxim\tests\fixtures\networking-job.json maxim\tests\fixtures\networking-contacts.json --no-store
npm run maxim:message-drafts -- maxim\tests\fixtures\message-draft-payload.json --no-store
npm run maxim:import-contacts -- data\maxim\contacts.csv --no-store
npm run maxim:import-contacts -- data\maxim\contacts.csv
```

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

## Remaining Operational Need

The normalized LinkedIn export also exists locally, but its field shape is less directly useful for ranking than `data/maxim/contacts.csv`. Use `maxim:import-contacts` as the operational contact ingestion path.
