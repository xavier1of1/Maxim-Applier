# Workspace Acceptance Evidence

Executed: 2026-11-16 to 2026-11-17. Scope: S1's manual workspace/agent slice only.
S0 was committed separately as 59834bb after 22/22 foundation/planning tests;
git status was empty before S1 implementation began.

## Implemented Surface

Next.js 16.4.6, React 19.3.1, Astryx 0.7.16, local Node 24.22.3,
PostgreSQL 18.1 and pinned app lockfile. One authenticated host web process,
loopback Compose DB and protected private files. No Dossier source copied.
[ADR 0006](../../docs/maxim/decisions/0006-workspace-implementation.md) records
the actual binding and bounded administrative exceptions.

## Acceptance Map

| Case | Executed proof |
| --- | --- |
| WSP-01 | Real HTTP role/intent creation, raw JD/URL, stable UUIDs/revisions, events, duplicate intent protection, web/DB restart, restored DB IDs and reference bytes |
| WSP-02 | Scripted provider through the actual streaming adapter requests declared tools, reads real fixture IDs/revisions; captured requests exclude credentials/private paths/foreign records and enforce budget |
| WSP-03 | Human-confirmed note, one event/outbox/command result; identical replay once, changed payload/stale revision refusal; SQL-trigger failure rolls back everything; concurrent replays and competing revisions |
| WSP-04 | Missing/expired session, raw wrong Host, wrong Origin/CSRF, second workspace, different confirmation session, expired/stale proposal and undeclared model confirmation all denied |
| WSP-05 | Real empty state, explicit 503 DB outage with client timeout/recovery; missing key; HTTP429/malformed/truncated provider streams; cancellation/client disconnect and expired-lease recovery persist truthful outcomes |
| WSP-06 | Actual Chromium desktop/mobile intake/chat/confirm plus keyboard focus trap/Escape/dirty draft guard; failed refresh and model errors; disabled future integrations; layout checks at 1600,1280,768,390,320 pixels |
| WSP-07 | Owner-only settings, key replacement/blank preservation without public echo; scoped download, attachment headers, tampered hash/path refusal; test/prod config denial; same backup/restore functions used by CLI and fixtures |
| WSP-08 | Strict typecheck, production build, disposable HTTP/DB/model integration, Chromium workflow suite; real start/stop, URL, storage and recovery commands in operating guide |

Main acceptance command: npm --prefix maxim/app test.
Same-context [EGM drift record](s1/2026-11-16_DRIFT_REPORT.md) compares the delivered boundary; it is not an independent review.
It runs typecheck, production build, integration and browser suites.
Integration: **21 passed** (20 scenarios plus parent); browser: **6 passed**.
No retries, skipped cases, production credentials or real model spend.
Final combined acceptance passed again on 2026-11-17. The keyboard case also
passed five repeated runs after explicitly waiting for the dialog (not a focused
tooltip) to own Escape. S0 recovery regression was rerun: 6/6 passed.

Additional checks: production npm audit reports **0 vulnerabilities**;
native Go dashboard go test ./... passes; static website safety passes.
Native units remain **53/55**, exactly the two S0 failures: unapproved fallback
attachment and source-audit --help. Their owners remain S5/S6 and S4 respectively.
The S8 Discord retry defect is not repaired by this stage.
The tracker-mutating root test-all runner was intentionally not run.
The keyboard case also passed five consecutive repetitions after waiting for
Astryx's focused tooltip layer to close before asserting dialog Escape behavior.
The staged-file secret-pattern scan found no matches; this is not a full historical
secret-clean guarantee. Git whitespace checks cover the complete staged source.

## Actual Test Environment

Windows host; pinned app Node 24; Docker Desktop Linux engine.
Each suite boots the production Next build with a sanitized environment,
disposable postgres:18.1 container, maxim_test_* DB, maxim-test-* temporary root,
two fixture identities and loopback HTTP scripted model. No production fallback
or test-only auth endpoint exists. Fixtures use ordinary login/command/API paths.

Wrong-Host testing uses node:http, because Node fetch normalizes/ignores a
custom Host header. Required Astryx input labels include Required; selectors
match their actual accessible names. No denial assertion was weakened to pass.

Faults found and fixed during execution:
- Separate conversation reads could mix a terminal run with its old lease:
  repeatable-read conversation snapshots now prevent this.
- Paused PostgreSQL cannot enforce its statement timeout: a client-side
  query timeout now returns unavailability within a bounded interval.
- Mounted hidden agent duplicated IDs/content: unique IDs and one active
  panel instance now preserve labels and avoid duplicate rendered messages.
- Dynamic filesystem tracing could collect the repository: app-scoped tracing
  and explicit external runtime inputs now keep private data outside bundles.

## UI Inspection

Playwright screenshots are local ignored artifacts under app test-results.
Desktop workspace/settings, mobile role/agent, and 1280/768/320 layouts were
checked for overflow, legible hierarchy and control framing. Tool payloads
are preserved in expandable details instead of overwhelming the conversation.
Keyboard tests prove focus enters/stays within the dialog and returns on Escape.
These checks are not a formal WCAG certification.

## Runtime And Remaining Setup

[Operating guide](../../docs/maxim/workspace.md) is authoritative for commands.
Preferred URL http://127.0.0.1:3010/maxim; launcher prints the actual selected port.
The real local workspace starts empty, without fixture jobs.
Actual launcher start, owned-process stop/restart and repeated-start reuse succeeded.
Health reports database available and recordFreshness not_assessed, not invented freshness.
The production private backup and isolated restore commands also succeeded with the empty
workspace (zero jobs/intents/references); populated recovery is proved in fixtures.
A user supplies their own provider key/model in Settings to enable live chat.

No live-provider smoke was performed: no key, account access, cost budget or
model quality is inferred from fixtures. The provider request has a conservative
byte cap, not exact tokenizer compatibility. Supported model feature requirements
are documented. Administrative credential rotation is protected-file atomic,
not a falsely claimed cross-filesystem database transaction.

## Handoff And Boundaries

Candidate identity is a minimal placeholder, not reviewed onboarding. Reference
files are neither extracted facts nor approved resumes. No scoring/PDF/scanner/
tracker/Go behavior was rewritten; no legacy migration or writer cutover occurred.
S2 owns intake/extraction/facts; S3 approved memory; S4 discovery; S5 retained
evaluation and tracker cutover; S6 browser execution. Gmail/Discord remain disabled
in this workspace. No application or outreach was submitted.

Recovery is verified to a separate DB/files, not automatic live promotion,
encryption, retention or off-device redundancy. Existing S0 private-content
classification concerns remain; no historical-secret-clean guarantee is made.
This is a same-context EGM drift check, not formal isolated-review convergence.
