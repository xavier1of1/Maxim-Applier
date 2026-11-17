# ADR 0007: Reviewed Candidate Authority And Rust Boundary

Status: Implemented for S2, 2026-11-17.

## Decision

Keep the S1 Next/React/Astryx workspace and PostgreSQL command boundary. Add the first consumed durable worker in TypeScript, using the maintained Node document parsers and the existing PostgreSQL client. Isolate deterministic typed-fact and retained tier-band validation in a small Rust executable under maxim/runtime. This honors the preference for Rust without rewriting a verified web/auth/session foundation or introducing a second database authority.

The Rust stdin/stdout protocol is bounded, has a five-second caller deadline and has no database, network, browser, credential-store or approval authority. Missing booleans and invalid scores are errors, never invented values. Native Career-Ops still generates fit assessments; tier mapping only consumes a valid 1.0-5.0 score.

Pin serde_json 1.0.154 and Cargo.lock, compatible with the installed Rust 1.76 MSVC toolchain. Do not upgrade the user's global toolchain implicitly. App builds compile the executable; missing binaries fail visibly rather than silently replacing policy with a different implementation.

## Consequences

One reviewed PostgreSQL candidate owner can be explicitly activated. Native files become hash-bound projections; legacy operation remains unchanged before activation. Private journal/marker recovery handles the filesystem/DB boundary honestly rather than pretending it is one atomic storage transaction. Parser/model outputs are source-linked proposals only.

The worker reuses durable leases for later discovery/evaluation consumers. No generic unused Rust server, parallel profile, LLM auto-approval, cloud upload requirement, or submitted-application automation is introduced.

See reviewed-onboarding.md for numeric limits, consent, erasure, backup and rollback semantics. S3 adds answer reuse/budgets; S5 adds evaluator/tracker authority. Those are not delivered by this ADR.

