# S5 Evaluation And Tracker Cutover Evidence

Date: 2026-11-17. APP-01 through APP-08 passed for the bounded S5 scope.
Production personal data was not imported,
approved or switched during acceptance.

## Environment And Isolation

Windows; pinned app Node 24.22.3; Rust 1.76/MSVC; PostgreSQL 18.1 Docker containers;
Next 16.4.6 / React 19.3.1 / Astryx 0.7.16; pinned Playwright Chromium; Go 1.26.4.
Retained extension tests also run under the host Node 20.15.1.

The app harness creates named maxim-test-* temporary roots/databases/containers,
scrubs inherited model credentials, uses a loopback model fixture and rejects
production fallback. The native full-suite harness copies only public unignored
source into a sanitized temporary checkout. No real application or Discord
message was sent; no paid live model quality claim is made.

## APP-01: Retained Score And Policy

Rust validates one complete retained A-G/H report, exact opening identity and one
strict finite 1.0-5.0 summary. Boundary/missing/invalid/conflicting-score tests pass.
The unchanged retained modes drive model evaluation; Rust does not assess fit.
S5 HTTP tests exercise T0 refusal, T1 reasoned override/revocation, policy holds
and archived-packet refusal. NoVA/DC/MD/multilocation/pay/clearance/freshness tests
remain in the Rust and retained Maxim suites.

The native Go and retained CLI adapters now leave invalid scores unknown instead
of manufacturing T0/T1; connection overlays cannot replace T0 or unknown fit.

## APP-02: Invocation Isolation And Replay

Two actual workers evaluate distinct openings concurrently with separate input/
prompt/context/model/engine snapshots, manifests and report artifacts. Replayed
commands commit once. Malformed and wrong-identity reports retain null score/tier
and review-required state without deleting another opening's PDF/report.

The final expanded suite passed a real killed evaluation process, expired-lease
reclaim and new invocation token, asserting one evaluation/application/report
artifact and two work attempts. This is separate from the earlier successful
S2/S4 killed-worker tests.

## APP-03: Exact Packet Approval

The real retained Chromium generator produces a PDF from escaped approved fact
values. PDF.js verifies text, Letter geometry, text margins, nonblank pixels and
renders a PNG for visual inspection. Desktop/mobile packet dialogs show exact
candidate/posting revisions and report/PDF/packet SHA-256 bindings.

Unapproved fallback and untailored packets require explicit review/consent.
Placeholders are refused. Sensitive/unapproved evidence is excluded. Fact/source/
consent/posting/policy/answer/engine changes invalidate future use. Correction
during another evaluation fences its publication. Submitted action evidence remains
immutable; unsubmitted derived evidence is purged after source erasure.

Protected backup/restore verifies the actual PDF bytes/hash, score and submission
snapshot in a new recovery DB/private artifact root.

## APP-04: Duplicate And Reapplication Identity

Job UUID/source identity and canonical URL retain distinct openings. Known tracking
parameters are ignored; real posting IDs are not. Same company/title on different
URLs warns without merging. Manual posting repair cannot replace an existing URL.

The final expanded case passed same-opening duplicate refusal without explicit
review, then an attributable manual reapplication declaration with separate IDs.
No application action is performed by the test outside the fixture.

## APP-05: Lossless Reviewed Import

Real GFM tables are parsed with pulldown-cmark, preserving empty cells, escaped
pipes, raw row/cell text and links. Exact source file bytes and all SQLite tables
remain separate from normalized records. Fixtures preserve a 64-bit integer above
JavaScript's exact range and a BLOB, raw JSONL/history and unapproved artifact links.

Source keys have stable maps; S1 IDs are preserved. Prior mappings require explicit
same-opening review or raw-only preservation, never a silent new identity. Every
row/outcome/conflict is reviewed before commit. Repeat source capture/commands are
idempotent. UI review and older application navigation are paginated/scoped.

## APP-06: Writer Ownership, Recovery And Restore

A real child holds the legacy write lease and completes an acknowledged edit while
activation waits. Changed source hashes stop activation. Pre-commit recovery
preserves that edit rather than restoring old bytes.

Reviewed activation freezes supported native writes and publishes canonical read
projections only after the DB owner commits. Corrupt/frozen projections fail native
reads. Explicit post-commit recovery republishes current acknowledged state.

Actual web/database restart retains IDs and outcomes. Rollback writes latest
Responded state to original SQLite IDs, keeps unrelated contact/int64/BLOB rows,
exports current history and disables canonical writes until reviewed re-cutover.

Backup v3 restores both candidate and application-family journals, including
rollback-state/IDs and generated projections. Restoration uses a new disposable
DB/private root, never overwrites originals and accepts earlier v1/v2 backups.

Writer inventory is in [the operator guide](../../docs/maxim/application-lifecycle.md#8-compatibility-and-retirement-inventory):
native merge/normalize/dedup, scanner/Gemini saves, batch sessions, managed PDF/
LaTeX outputs, SQLite/EventLog application writes and Go decisions/status changes.
Batch child leases, Windows case/junction aliases, corrupt markers and inherited
lease identity are handled explicitly. No unsupported Go decision returns nil.

## APP-07: Retirement And Native Regressions

Rejected planner/mapper implementations and browser-test imports are removed;
old script paths only return an explicit retirement failure. Package registrations
are gone. Twelve useful safety scenarios remain as S6 requirements, not a fake
browser executor or browser-acceptance claim. Historical private run reports are
untouched. Seven obsolete guides are preserved under docs/maxim/archive/pre-s5;
active guides point to the implemented workflow.

Native report semantics, scoring modes, PDF/LaTeX/liveness and the Go dashboard
remain retained. Hash-checked canonical sync/dashboard reads replace stale SQLite
fallback; unadapted analytics/Discord consumers stop explicitly. The previously
failing legacy HTTP-429 notifier test is fixed: no suppression fingerprint is
stored before confirmed HTTP acceptance. This is not S8 durable delivery.

## APP-08: Shared Reads And Truthful Manual States

API, agent and native Go read the same canonical application UUID/outcome after a
real web/DB restart. Desktop/mobile UI reload preserves score/tier/workflow/outcome.
Preparation, start, review, actual manually filled state, submission and later
outcome are distinct. Manual external submissions remain valid with no approved
packet or invented score. Current user instructions are required to queue an agent
evaluation; no approval/submission model tool exists.

## Commands And Recorded Results

`npm run maxim:workspace:test` passed: 29 Rust, 15 unit, 72 integration TAP
cases (including parents), 15 Chromium workflows, typecheck and production build.
Final completed-application UI polish was rebuilt and all three targeted S5
Chromium workflows passed again. The retained PDF PNG was visually inspected;
Letter dimensions, margins, text fidelity and nonblank pixels passed.

- `npm run maxim:test`: 57 passed, including ownership/hash/path-alias/retirement,
  unknown-score/T0, parser/policy, legacy sync/networking/history and HTTP-429 cases.
- `npm run maxim:native:test`: upstream runner reports 146 passed, zero failed,
  one expected missing-CV warning in sanitized data; Go build succeeds.
- `go test ./...` under dashboard: all packages pass. The explicit isolated Go
  integration fixture also checks canonical UUID/status and write refusal.
- `npm run maxim:safety`: passes with no prohibited patterns.
- `npm run maxim:privacy`: public text/known configured-secret-copy and ignored
  private-path checks pass; no values are printed.
- Roadmap graph/link/evidence validation and its 17 tests pass after promotion.
  Post-merge Windows checkout exposed CRLF normalization in the original-comment
  guard; the follow-up accepts only Git line-ending conversion, with tests still
  rejecting content/trailing-whitespace edits. The original source blob is unchanged.

The upstream runner's Unix grep privacy sections do not constitute Windows
privacy proof. The separate public-tree checker covers configured-secret copies
and ignore boundaries; it is not a semantic proprietary-content audit.

## Review And Limits

This is a same-context implementation/spec audit using the installed EGM guidance,
not a formal independent Goldfish review. No fresh-context/human-resolution gate
is claimed.

Still separate: live model scoring-quality review, optional Hiring Panel, the S6
visible browser executor, S7 Gmail, S8 durable Discord, S9 canonical networking/
history/analytics and S10 interview preparation. Optional components do not block
the bounded S5 lifecycle. No application submission, LinkedIn sending, CAPTCHA
workaround or anti-bot dependency was introduced.
