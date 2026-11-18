# MVP Completion Verification

Date: 2026-11-17 America/New_York (testing continued into November 18 UTC).
Branch: `maxim/mvp-completion`. This is measured implementation evidence and a
remaining-work record, not full MVP acceptance or an independent EGM review.

## Delivered Code

| Stage | Implemented integration | Remaining acceptance |
| --- | --- | --- |
| S6 | Pinned native agent-browser, headed dedicated session, current approved evidence/PDF, exact answer reuse, pause/resume, manual handoff, owned shutdown | Final changed integration/UI rerun and dated permitted live form-variant inspection |
| S7 | Read-only Google OAuth/PKCE, selected-thread evidence/corrections/tasks, retention/revoke, UI/agent read/worker | Final combined rerun; owner OAuth setup and live consented smoke |
| S8 | Protected existing webhook, preview/consent, persistent outbox/attempts, bounded retry/uncertainty, calendar schedules, domain/task producers | Final combined rerun; exact destination/contents and live accepted message |
| S9 | Raw CSV/XLSX/ZIP preservation, reviewed contacts/history, role shortlist/research/five-part manual drafts, recruiter corrections, cohort analytics | Final mounted rerun; deliberate personal import/reconciliation, not automatic legacy cutover |
| S10 | Role-linked private practice, approved evidence, bounded optional model feedback, cancel/revision/retention guards | Final rerun after context/transport integration; real model quality untested |
| S11 | Two full-product rehearsal tests, all-view desktop/mobile test, operator guide and proposed demo script | New rehearsals/UI tests not yet executed; demo profile not owner-approved |

These stages remain **In progress**, not Verified. Merely applying migrations or
building navigation does not satisfy their live, review or recovery gates.

## Executed Checks

Environment: Windows; app Node 24.22.3; Rust 1.76/MSVC; Go 1.26.4;
Next 16.4.6/React 19.3.1/Astryx 0.7.16; PostgreSQL 18.1 fixtures;
agent-browser 0.43.0 and Chrome for Testing 158.0.8127.36.

- App unit suite: **35 passed, zero failed** after final browser/control/evidence
  changes. Uses real native Chrome, not an executor stub. Native hidden resume
  selection retains the exact PDF through synthetic manual submission; network
  effects are blocked until handoff. Lever URL and same-origin different-opening
  checks pass. Gmail transport/schema bounds, Discord calendars/backoff,
  history/parser/metrics and interview evidence rules pass.
- Rust domain suite: **29 passed** (`cargo test --locked --manifest-path maxim/runtime/Cargo.toml`).
- Retained Maxim extension: **57 passed** (`npm run maxim:test`).
- Sanitized native Career-Ops: **146 passed, zero failed, one expected missing-CV
  warning** (`npm run maxim:native:test`). Native shell-based privacy subchecks
  emit Windows path warnings; the separate Maxim public-tree privacy check passes.
  Personal trackers were never opened/mutated by this proof.
- `go test ./...` in dashboard: passed.
- Final TypeScript and production Next build: passed after all mounted-module,
  browser, safety and whole-project evidence changes.
- Safety: passed after fixing flagged interval polling and unlimited chunk loops.
  No exemptions were added. Local UI refresh is sequential, visible-only and
  bounded to ninety seconds. Gmail/Discord reads have byte/time/chunk ceilings.
- Privacy: passed with zero findings (538 public/unignored text files at that run).
- Roadmap validator: passed (12 stages, 92 cases, original comments unchanged);
  its 17 regression tests pass. Product acceptance remains explicitly false.
- Initial mounted S6 API/worker/agent-browser test: **3 TAP cases passed** before
  final hidden-upload, revoked-answer and same-opening regression additions.
  A repeatable-read fix prevents contradictory action/session snapshots.
- Standalone S7 lane: reported 17 provider/DB cases and two UI cases passed.
  S8: four unit, 17 DB and two UI cases passed, plus legacy 429 regression.
  S9: four unit, seven DB and two UI cases passed. S10: four initial unit,
  13 integration and one UI case passed. These were actual isolated lane runs,
  not proof of the final main dispatcher wiring or any real account connection.

## Interrupted And Unrun Checks

The final full app integration run and S6 UI run were stopped when **C: reached
zero free bytes** and Docker Desktop became unresponsive. Completed output from
that partial run is not a passing suite. A later bounded Docker preflight failed
explicitly. The two new product rehearsals and all-view UI test remain unrun.

Only Maxim's newly downloaded 449 MB agent-browser binary directory was relocated
to ignored storage on D:, retaining its normal path via a junction. No broad
prune, Docker-volume deletion, private-data relocation or unrelated cleanup ran.
Tests can use `D:\MaximApply-TestTemp` through TEMP/TMP; this must remain outside
the repository because production private-root protections also apply to tests.
Docker still uses C:, so changing test TEMP does not solve its capacity problem.

No real candidate data was filled, employer application submitted, Gmail account
authorized, webhook configured or external model request sent in this work.
Candidate/application ownership and production disclosure were not activated.
The production stack was stopped for rebuilding and remains stopped pending
Docker/disk recovery. Its private data and pre-change backup were retained.

## Resume Verification

**November 18 storage follow-up:** Docker is responsive again. Fixture lifecycle,
volume cleanup and disk headroom checks are implemented. Final targeted S6/S8/S10
integration passed 33 cases; 70 retained Maxim and 35 app unit checks pass. Three
real database cycles plus an actual interrupted-owner recovery left no new owned
resources. A fresh private backup/restore passed; user ownership remains legacy.
Separately approved shared build-cache cleanup reported 21.25 GB reclaimed inside
Docker, without deleting any application image, container or database volume.
See [storage evidence](../../docs/maxim/storage-maintenance.md). Full S11/UI/live
acceptance remains open; the original outage record above is historical.

1. Confirm Docker remains responsive and its actual drive still has at least
   10 GiB free. Recovery/cache cleanup has run, but the disk remains on C:.
   Do not delete live/unverified volumes or run broad prune. Use the owned-resource
   preview/apply command for any new interrupted test leftovers.
2. From maxim/app, prepend `node_modules/node/bin` to PATH, optionally set
   TEMP/TMP to an external test directory and run `npm test` for Rust, unit,
   production build, full integration and full Playwright checks.
3. Inspect synthetic desktop/mobile screenshots; resolve every failing assertion.
   Run `npm run maxim:test`, `maxim:safety`, `maxim:privacy`, `maxim:native:test`,
   Go tests and both roadmap checks again after changes.
4. Approve a demo profile, certify only the permitted live form variants actually
   observed, and connect optional integrations only with separate owner consent.
5. Record exact results, commit each remaining correction, then merge after green
   verification. Do not promote S6-S11 or merge on the basis of this document.

## Known Product Limits

- Fresh contained browser sessions do not persist remote form state across daemon
  shutdown; network locking limits dynamic validation/upload/multi-step forms.
- Greenhouse/Lever pilot allowlists are not universal form certification.
  Workday/LinkedIn/Indeed/custom sites use explicit manual fallback.
- Gmail selection is explicit and checks are manually requested, not all-mail
  monitoring. Interactive Discord commands and Meta glasses are not MVP features.
- Networking research is human supplied, outreach is manual. No LinkedIn sends.
- S9 imports do not silently retire or migrate all legacy contact/history writers.
- Final application submission, evidence approval and disclosure remain human
  actions. There is no fabricated experience, fit-score replacement or auto-submit.
