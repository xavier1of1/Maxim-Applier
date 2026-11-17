# 0009: Bounded Retained Discovery

Accepted implementation: 2026-11-17.

Use existing Career-Ops Greenhouse/Lever/Ashby mapping functions inside an injected,
read-only transport boundary. Do not import `scan.mjs` or execute local-parser commands
from the web process. Native provider modules are fixed allowlisted runtime paths, not
copied code or unrestricted module names; run from the documented app working directory.

Store query/source revisions and raw observations in canonical PostgreSQL with existing
job IDs. Separate identity, source freshness, posting time, eligibility and retained fit
score. Missing compensation/dates remain unknown. Rust owns deterministic policy only.

Bound and persist network requests before execution, pin public DNS/peer identity, deny
redirects, enforce bytes/deadline/pacing, checkpoint pages and fence every publication.
Use explicit manual fallback, not stealth, retries around challenges or false empty-success.

Optional broad-provider subscriptions and universal company-site search are not required
or certified by this increment. Same-context implementation review is not independent
EGM Goldfish convergence.
