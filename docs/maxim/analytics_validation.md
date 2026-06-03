# Maxim Analytics Validation

Last updated: 2026-06-03

## Status

COMPLETE for fixture/simulated records. Real analytics conclusions remain blocked by missing real Career-Ops application outcomes.

## Commands Run

```powershell
npm run maxim:analytics
npm run maxim:e2e
npm run maxim:test
```

## Primary KPI

The primary KPI is interview rate percentage for NoVA/DC-compatible roles:

```text
interview_rate = interviews / NoVA_DC_compatible_applications
```

The live local store currently has no real Career-Ops application rows, so:

- Numerator: 0
- Denominator: 0
- Small-sample warning: present

The E2E fixture run proves the KPI path with one NoVA/DC-compatible fixture interview:

- Numerator: 1
- Denominator: 1
- Value: 100% fixture-only
- Small-sample warning: present

## Segmentation Coverage

`createMetricSnapshot` now includes breakdowns for:

- Career-Ops score band
- Maxim tier
- Source
- Role lane
- Salary band
- Freshness
- Networking status
- Connection strength
- PDF/resume variant
- Company type
- Recruiter involvement

## Limitations

The current live analytics output must not drive strategy changes because real denominators are missing. The roadmap's no-overfitting rule remains in force: recommendations require enough real usage data and Xavier approval.
