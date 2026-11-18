# ADR 0011: Native Agent-Browser For Reviewed Application Assistance

Date: 2026-11-17. Status: implemented pilot; live form certification outstanding.

## Decision

Use pinned agent-browser 0.43.0 as the S6 execution backend. Its native local
Rust/CDP CLI runs a named, dedicated headed Chrome session. The TypeScript
adapter sends an allowlisted batch of typed commands over stdin and acknowledges
the result before publishing progress. Playwright is not the product application
executor; it remains useful for existing Career-Ops PDF generation and UI tests.

## Rationale And Constraints

This follows the accepted component assessment and user preference without
rewriting the retained engine. The native CLI provides observation/fill/upload
primitives, but no library makes arbitrary ATS forms reliable by itself. Exact
evidence, identity/revision checks, local storage and a manual final-action policy
remain Maxim's responsibility. Snapshot-plus-trusted native-control extraction
does not claim unrestricted visual navigation or universal site support.

Use fresh sessions, domain/action allowlists, no plugins/WebMCP/cloud/ordinary
browser attach and no saved credential/cookie replay. Agent-browser rejects
domain allowlists combined with profile/state/CDP replay; choose the former.
Lock network after load and before values, then explicitly release only for manual
control. Dynamic/iframe/multi-step forms need manual handling. Lost daemon state
is not durable remote form state; reconnect must re-observe, never auto-replay.

Exact reviewed report/PDF/candidate/answer/source bindings come from S2/S3/S5.
Agent tools cannot approve those bindings or final actions. PostgreSQL owns
intent/action acknowledgments; the employer owns external submission reality.
An uncertain action pauses. Final submission is an explicit user declaration,
never inferred from a CLI result. No LinkedIn send or platform evasion is added.

## Verification

Real native Chrome synthetic-form checks cover controls, stale-value denial,
hidden resume upload, exact PDF bytes, contained effects and explicit handoff.
The mounted S6 integration passed before final regression additions. The final
full integration/UI and S11 rehearsals were interrupted by C: exhaustion and
unresponsive Docker, not counted as pass. See the dated verification record.
No production applicant information or credentials were sent during these tests.
