# Filters And Agent Controls

## Intent
Build global filters, archive table, settings and reviewed proposals.

## Contract
One existing Astryx workspace, shared authenticated services and one policy schema.
No standalone CRM or request-failure mock fallback.

## User Journey
Settings exposes source rotation, cadence, capacity, age/title/evidence policy,
request/token/price allowances, explicit automation consent and pause. The scoring
preview and cycle receipts explain holds and link to recovery surfaces.

Chat can read settings and draft an exact strict-schema patch on the current user
request. Only the owner can approve it, with optimistic revision and consequential
permission checks. No agent confirmation or secret-setting tool is registered.

Jobs applies company, industry, title/location text, role lane, posted age, current
score range and evaluation state in SQL before its 50-row UI page. Sort/filters/
page position persist in URLs. Facets cover the complete relevant active/archive
cohort. Archived status never retains an invisible active-only location filter.
Unknown industry is explicit and can be owner-confirmed per source.

Archive is a separate compact-history table, with posted/location/qualification/
historical fit fields and identity-preserving restore. The selected role remains
inspectable even when outside the current filtered list.

## Verification Boundary
Desktop/mobile proof covers actual saved settings, safe disabled defaults, owner
proposal approval, global filtering after 500 records, URL reload, cleanup preview
invalidation and restore. Backend and model failures stay visible.
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
