# Filters And Agent Controls

## Intent
Build global filters, archive table, settings and reviewed proposals.

## Contract
SQL filters/sort precede page limits. Preserve URL selection. Industry has provenance. UI/agent share validation; only the owner approves changes or destructive/spending consent.

See the [roadmap](../README.md) for defaults, interfaces and authority. Extend only
the existing service boundaries; preserve Career-Ops and approved data contracts.

## Acceptance And Handoff
Implemented SQL-before-pagination company/industry/role-type/location/date/current
score/evaluation filters, 50-row UI pages, URL persistence and selected-record
preservation. Industry remains Unknown until confirmed on a source in Settings.
The existing Astryx workspace now exposes owner-only automation/budget/capacity
controls, shortlist reasons, cycle holds, chat proposals, preview/confirm cleanup
and a separate compact-history table with restore. Existing model controls remain.

Evidence: production build; global filtering and existing fit integration tests;
six Chromium cases at desktop/mobile for fit/model controls and retention/filter
journeys. No fallback mock records or separate dashboard was introduced.

Desktop/mobile plus auth/CSRF, stale approval, unknown industry/date and complete filter/reset cases.

Commit each stage after checks. Update standing from actual evidence, not planned
tests or an account integration that remains disabled.

> **Comments**
> Add stage-specific feedback and findings here.
