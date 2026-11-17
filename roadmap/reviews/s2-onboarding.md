# S2 Reviewed Onboarding Acceptance

Verified: 2026-11-17. Branch: maxim/v2-career-ops-fork, after S1 ef7d698.
This is fixture-backed implementation acceptance, not approval/import of Xavier's personal files.

## Commands And Environment

`npm --prefix maxim/app test` passed: TypeScript, Rust build/tests, parser unit tests, production Next build without tracing warnings, isolated integration suite and Chromium suite.
Environment: Windows; app-local Node 24.22.3; Rust 1.76.0 MSVC; PostgreSQL 18.1 disposable Docker containers; Next 16.4.6/React 19.3.1/Astryx 0.7.16; scripted loopback model; Playwright Chromium.

Results: 8 Rust tests, 6 parser tests, 32 integration TAP cases (including suite parents), 8 browser workflows.
Additional `go test ./...` in dashboard passed, `node maxim/scripts/website-safety-check.mjs` passed, and retained `node gemini-eval.mjs --help` passed without candidate writes.
Existing native 53/55 baseline findings remain assigned to later stages; the data-mutating native recursive runner was not run on personal tracker files.

## Case Evidence

| Case | Implemented proof | Result |
| --- | --- | --- |
| ONB-01 | Real PDFKit PDF/encrypted/blank/31-page documents; real zipped DOCX; MD/TXT; malformed/UTF-8/NUL/oversize and ZIP traversal/bomb/macro/entity tests | Passed |
| ONB-02 | HTTP duplicate hash with renamed source cannot broaden disclosure; stable source/fact IDs; revisioned replacement; worker restart and saved proposal IDs | Passed |
| ONB-03 | Actual two-worker queue; expired token cannot publish; cancel/retry; kill real worker while publication waits on candidate lock, expire lease, restart and publish exactly once | Passed |
| ONB-04 | Source-linked review/reject, typed false and missing-boolean rejection; explicit differing/stale-value conflict replacement; agent exact-declaration proposal creates no approved fact; desktop/mobile review dialogs | Passed |
| ONB-05 | Captured model requests remain empty for unconsented sources; restricted classification/text denied before send; allowed synthetic source redacts contact data and only proposes | Passed |
| ONB-06 | Corrected fact invalidates context; queued projection refresh updates native files; source consent revocation removes facts from current tool output and previous chat history; rejection/withdrawal excluded | Passed |
| ONB-07 | Fixed native-file import stages only; baseline-change refusal; exact prepared cutover; native current hash/revision check and tamper refusal; frozen interrupted recovery; rollback retains latest corrections and full private export | Passed |
| ONB-08 | Second-workspace source/download/command denial; path/junction escape refused; deletion denies download and removes bytes; dependent chat erased; raw retention retains confirmed facts; version-2 backup restores database revisions and exact cutover journals separately | Passed |

## Browser And Visual Review

Production Chromium exercised 1600x1000 and 390x1000 onboarding upload, exact quotations/conflicts, explicit replacement, correction after refresh, disclosure cancellation and erasure. Source and knowledge screenshots were inspected. No horizontal overflow or out-of-viewport controls; no browser page errors. S1 regression includes 1280/768/320 layouts, dirty-state protection, keyboard focus/cancellation, empty/backend/model failure, no-key manual operation and agent tools.

Initial failures were not hidden: JSON object order caused a false cutover conflict and was fixed with per-file hash equality; required Astryx field suffixes required semantic test-label matching; erased source names were intentionally scrubbed, so UI assertions now expect removal of the original name.

## Scope And Remaining Boundaries

No real model call, public source request, personal import/approval, production candidate activation, application submission, message delivery, browser automation or credential intake occurred. The DB migration is applied by setup; installation never switches candidate ownership.
No OCR guarantee or universal resume layout understanding is claimed. Backup/journal expiry remains explicit owner policy, not automatic deletion. S3/S4/S5 remain unverified until their own evidence.

This is a same-context implementation/design consistency review using installed EGM guidance, not an independent Goldfish review or formal convergence claim.

