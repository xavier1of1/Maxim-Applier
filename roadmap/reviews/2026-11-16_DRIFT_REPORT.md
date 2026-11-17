# Maxim Apply Design/Code Drift Report

**Date:** 2026-11-16.
**Method:** EGM drift-report workflow: read each scoped design, locate/read corresponding code, report differences. Same-context audit; not a formal independent multi-reviewer EGM loop or convergence.
**Scope:** Six primary planning documents as they stood before this refinement. Original user comments are a preserved source, not an editable design target.
**Interpretation:** The documents mark target work Pending. Missing target features below are planned implementation gaps, not claims that already-shipped product code regressed. Runtime defects are identified separately and remain unfixed by this planning pass.

## README.md

- **DR-01 [planning gap]:** The old S4 dependency allowed work after S1, but required durable scanning while no producing stage supplied a consumed worker. Refined dependency is S2 -> S4; S2 extraction creates the first worker.
- **DR-02 [planning gap]:** S5 required S4 even when a user supplied a job manually. This needlessly made search-provider coverage/account setup block evaluation and assistance. Refined S5 depends on S3; S4 is conditional for discovered jobs.
- **DR-03 [runtime defect]:** The baseline has no working replacement web/agent runtime. The [Go decision method](../../dashboard/internal/maxim/service/service.go) returns nil without a write. Detailed S1/S5 require shared actual commands and no false acknowledgement.
- **DR-04 [verification gap]:** Prior tests were historical only. This session reran 55 unit tests (53 pass, 2 fail), isolated Discord retry (fail), static safety (pass), and dashboard Go tests (pass after permitted dependency access). Do not retain the old 61/64 figure as this session's result.

## MANIFESTO.md

- **DR-05 [planned gap]:** Accepted PostgreSQL/private artifact/canonical knowledge targets do not exist in [current SQLite schema](../../maxim/db/schema.sql). The [bridge](../../maxim/lib/sqlite-store.mjs) commits separate Python operations; [JSONL events](../../maxim/lib/event-log.mjs) are separate writes. Transactional event/idempotency authority must be implemented, not inferred.
- **DR-06 [planning gap]:** Headed Chromium on Windows and a generic containerized backend were not bound to a concrete usable composition. Refined default is host web/worker/browser with loopback PostgreSQL Compose; remote/container bridge is separate design.
- **DR-07 [runtime defect]:** [Application matching](../../maxim/lib/application-tracker.mjs) can reuse a record by company and overlapping role text after failing exact match. Distinct openings need source aliases and explicit merge/reapply handling.
- **DR-08 [runtime defect]:** [Metrics](../../maxim/lib/metrics.mjs) divides by compatible records without requiring confirmed submitted attempts. S9 must implement the explicit cohort/unknown/exclusion denominator.

## high-level-roadmap.md

- **DR-09 [planned gap]:** Early UI/agent/auth/storage has no product package/migrations/API yet. S1 now includes actual local authentication, scoped commands, atomic events, a real isolated harness and production-build/UI proof rather than a placeholder shell.
- **DR-10 [planning gap]:** Candidate cutover had not enumerated native profile writers, and tracker cutover could leave TSV/merge/modes/Go writes active. S0 inventories each; S2/S5 gate/adapter changes are required before authority switch.
- **DR-11 [planning gap]:** Browser final-action enforcement was underspecified. Label matching cannot prove absence of final effects. S6 specifies supported typed adapters, observed control identity, file/origin/session authority, denied keyboard/form/network actions and manual fallback on unknown effects.
- **DR-12 [runtime defect]:** [Tier input coercion](../../maxim/lib/tier-router.mjs) maps null/empty to T0 and 6 to T3. Read-only probes reproduced all three. S5 APP-01 requires absent/out-of-range score validation without changing Career-Ops scoring semantics.
- **DR-13 [verification gap]:** [test-all.mjs](../../test-all.mjs) invokes normalize/dedup/merge. It must not be executed against personal trackers just to validate a document revision; S0 requires isolated-root execution or an explicitly bounded subset.
- **DR-14 [planning gap]:** Foundation-only rehearsal could be confused with completed application acceptance. S11 now requires S6 for its full assisted-application claim; S0-S3 rehearsal is explicitly a narrower milestone.

## external-components-assessment.md

- **DR-15 [integration gap]:** Dossier/Astryx/browser/skills are references, not installed product components. Their desired UI/search/practice behaviors are absent from the current fork; new detailed stages carry adoption/license/privacy/verification gates rather than treating repository links as implementations.
- **DR-16 [integration gap]:** Existing [scanner](../../scan.mjs) writes pipeline/history and is not a side-effect-free imported search API. S4 now specifies provider reuse or bounded isolated invocation with no accidental legacy writer activation.
- **DR-17 [integration gap]:** No broad LinkedIn job/apply/inbox capability follows from the proposed profile/export/publishing connector. S6/S9 separate browser support, job discovery, contact import and prohibited social writes.

## development-workflow.md

No drift detected.

## operational-setup.md

- **DR-18 [runtime defect]:** [Discord notifier](../../maxim/scripts/discord-notify.mjs) stores a fingerprint before [POST](../../maxim/scripts/discord-notify.mjs) and ignores response acceptance. The isolated 429 test reproduced permanent suppression; S8 owns replacement/repair and durable retry.
- **DR-19 [runtime defect]:** [Source-audit help](../../maxim/tests/unit/source-readiness.test.mjs) fails because --help is treated as an input filename. S4 DSC-01 owns the fix.
- **DR-20 [runtime defect]:** [Fallback attachment safety](../../maxim/tests/unit/assisted-apply-safety.test.mjs) fails: an existing unapproved resume is offered. S5/S6 require explicit attachment approval, not filename/config existence.
- **DR-21 [planned gap]:** Future DB/model/Gmail/search/schedule settings still have no implementing parser/runtime; current secrets were not inspected or used for live actions. Detailed stages retain current-vs-proposed setup and require actual startup/recovery instructions upon delivery.

This report changes no runtime code or candidate data. See [refinement record](roadmap-refinement.md) for the planning repairs, test scope and remaining decisions.
