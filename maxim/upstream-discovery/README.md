# Pinned Career-Ops Discovery Bridge

This is a discovery-only integration of Career-Ops 1.40.0. Original source and
MIT license are retained under `../vendor/career-ops-discovery/`; `source-lock.json`
pins every imported byte to the upstream commit. Run `vendor.mjs` only for an
explicit mechanical refresh and review its diff. No upstream native writer runs.

`catalog.mjs` accounts for all 153 modules. Availability means installed, not
live certification. Regional, employer, tenant, board, blocked and retired sources
remain distinct. `bridge.mjs` executes providers in short-lived Node permission
processes with read-only source access, no child/worker/addon or file-write grants,
sanitized environment, memory/deadline/output limits and parent-owned HTTP.

The module hook substitutes upstream `_http.mjs` with `transport.mjs`, routes
global fetch through the same channel and refuses unapproved imports, including
native network modules, browser drivers and executable parsers. Original helper
source is retained for provenance but its proxy/cache/DNS transport does not run.
The parent pins public DNS peers, refuses private hosts/redirects/challenges and
enforces pacing and request/byte limits. This is audited trusted-code containment,
not an OS network sandbox for malicious JavaScript: do not install arbitrary
modules or accept executable configuration from websites.

Automatic retries are deliberately delegated to Maxim cooldown/retry boundaries.
Provider result arrays include upstream truncation metadata before serialization;
full descriptions are not inferred from CLI receipts or text length alone.
