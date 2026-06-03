# Maxim End-To-End Validation

Last updated: 2026-06-03

## Status

COMPLETE with fixture data and BASIC REAL-WORKFLOW validation. Real application outcomes are still required for meaningful interview-rate analytics.

## Command

```powershell
cd "d:\VSC Programs\maxim-apply"
npm run maxim:e2e
```

Real workflow commands run:

```powershell
npm run gemini:eval -- --file jds\blen-senior-software-developer-full-stack-2026-06-03.txt
node generate-pdf.mjs "$env:TEMP\cv-xavier-kubancik-blen-2026-06-03.html" output\cv-xavier-kubancik-blen-2026-06-03.pdf --format=letter
node merge-tracker.mjs --verify
npm run maxim:sync
npm run maxim:analytics
npm run maxim:dashboard-state
npm run maxim:operational
```

## Input

Fixture-only job:

- Report: `maxim/tests/fixtures/reports/sample-report.md`
- PDF path mock: `maxim/tests/fixtures/output/federal-platform-labs-software-engineer.pdf`
- Company: Federal Platform Labs
- Role: Software Engineer, Mission Systems
- Career-Ops score: `4.6`
- Location: Arlington, VA
- Salary: `$95,000 - $125,000`

## Proven Workflow

```text
Job
-> Career-Ops Evaluation fixture
-> Maxim sync
-> T3 tier assignment
-> policy flags
-> dashboard snapshot
-> networking shortlist
-> message draft
-> recruiter Needs Response thread
-> analytics snapshot
-> notification plan
```

## Output Summary

- Career-Ops score: `4.6`
- Maxim tier: `T3`
- Priority flags:
  - `location:positive`
  - `salary:positive`
- Next action: `urgent_high_conviction_action`
- Networking target:
  - Rank score: `88`
  - Reasons: same company, connection strength 2, recruiter/talent role, role-lane relevance
- Draft message:
  - Status: `ready_to_send`
  - Five-part structure validation: passed
  - Channel: `linkedin_manual`
- Recruiter tracking:
  - Status: `Needs Response`
  - Needs response: true
- Dashboard visibility:
  - Today actions: 3
  - High Conviction jobs: 1
  - Networking queue: 1
  - Recruiter Inbox: 1
  - Applications: 2
- Analytics:
  - Interview-rate numerator: 1
  - Interview-rate denominator: 1
  - Small-sample warning present
  - Breakdowns include score band, tier, source, role lane, salary band, freshness, networking status, connection strength, PDF variant, company type, and recruiter involvement
- Notifications generated:
  - Urgent T3 role alert
  - Networking draft batch
  - Recruiter Needs Response
  - 3-week resume/PDF variant review

## Limitations

Fixture validation does not claim Xavier has applied to the fixture company or contacted the fixture people.

The real BLEN validation proves one public posting can move through Career-Ops evaluation, PDF generation, tracker verification, Maxim sync, dashboard snapshot, and operational readiness. It does not claim Xavier submitted an application, contacted BLEN, or received an interview.

## Real BLEN Workflow Evidence

- Public posting source: BLEN Senior Software Developer I - Full Stack, Washington, DC.
- Local JD: `jds/blen-senior-software-developer-full-stack-2026-06-03.txt`.
- Career-Ops report: `reports/001-blen-2026-06-03.md`.
- Career-Ops score: `3.9/5`.
- Maxim tier after sync: `T1`, strategic override only.
- Generated PDF: `output/cv-xavier-kubancik-blen-2026-06-03.pdf`.
- Tracker row: `data/applications.md`, row `1`, status `Evaluated`, PDF marked ready.
- `npm run verify`: passed with 1 tracker row, 0 errors, 0 warnings.
- `npm run maxim:sync`: 1 evaluation, 1 application, 0 warnings.
- `npm run maxim:dashboard-state`: applications count `1`.
- `npm run maxim:operational`: `operationalReady: true`.
