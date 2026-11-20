# Reviewed Application Assistance

Updated: 2026-11-19. Implementation uses **agent-browser 0.43.0**, its native
Rust/CDP CLI and dedicated Chrome for Testing. Playwright remains the retained
Career-Ops PDF renderer and automated UI test tool, not this product executor.

## Supported Boundary

| Destination | Implemented behavior | Acceptance standing |
| --- | --- | --- |
| Isolated localhost native form | Text, email, textarea, native select/check, hidden native resume input, exact approved PDF, answer reuse and manual handoff | Real agent-browser unit, mounted integration and desktop/mobile reviewed-answer flows passed |
| Greenhouse listed pilot hosts | Specific stored posting, top-level native controls only | Live form variant not certified; no real candidate fill performed |
| Lever jobs.lever.co | Stored posting opens its /apply URL; top-level native controls only | Live form variant not certified |
| Workday, LinkedIn, Indeed, arbitrary company domains | Preserve role; explicit unsupported/manual fallback | No universal support claim |
| Embedded frames, custom widgets, credentials, voluntary self-ID, declarations | User handles manually | Never inferred or bypassed |

An allowed host is not proof of a supported live form. Dynamic controls may not
be ready when observed. Re-inspect or use manual fallback; no hidden click loop,
challenge workaround, account creation or unrestricted model browser tool exists.

## Use The Assistant

1. Start the [workspace](workspace.md), sign in and review Candidate knowledge.
   Explicitly activate candidate/application authority only after reviewing their
   projection/reconciliation screens. Startup never performs these approvals.
2. Save a role and application intent. Applications evaluates with the retained
   Career-Ops engine. Select approved facts, build a packet, inspect its report
   and PDF, and approve the exact hashes. T0 is blocked; T1 needs an override.
3. From the exact application, choose **Open Apply Assistant**. Review the
   selected approved packet and authorize the dedicated browser. Changing roles
   or packets requires its own consent. Private contact/authorization disclosure
   is a separate choice. No credentials are requested through Maxim.
4. Choose **Fill approved fields and PDF**, or review a field's exact fact.
   Each operation rechecks scope, revisions, observed control identity and value.
   Existing user changes are not silently overwritten. The selected PDF is the
   approved packet's exact bytes, not the newest file in a directory.
5. For an unknown question, **Save question** pre-fills the exact Answers form.
   Record and approve the answer, then **Return to Apply Assistant**. Choose
   **Find approved answer**, inspect it, and **Confirm and fill this answer**.
   Company, exact question/options, fact/source versions and reuse permission
   apply. Revocation blocks further use and handoff until corrected/refilled.
6. Pause/resume or re-inspect as necessary. Review the field progress and PDF hash.
   Unknown questions and custom controls remain manual; missing facts are unknown.
7. **Review and take manual control** explicitly releases containment and detaches
   automated actions. The employer may now retain entered data, including autosave.
   Only you review/finalize the external application. Maxim does not click Submit.
8. Record an actually completed manual submission/outcome in Applications.
   Filling, uploading, handoff and closing never imply submitted. Close the
   dedicated browser when finished. Workspace stop closes only owned sessions.

The Agent can read assistance status and fill approved fields in an **already
user-authorized** session. In a conversation for the same stored job, ask
`Fill approved fields`. In an unscoped conversation, use
`Fill approved fields in <session UUID>`. It cannot approve evidence,
grant disclosure, attach arbitrary paths, send outreach or submit applications.

## Containment And Recovery

All network traffic is locked **after the initial page load and before filling**.
Trusted DOM guards also inhibit final form actions/Enter. This deliberately
prevents remote autosave during automated preparation, but can prevent dynamic
validation, upload processing and multi-step navigation. Handoff releases the
network lock; it is not a promise that remote pages cannot react or autosave.
Review visible employer behavior before proceeding. Never use real submissions
as tests. An employer can retain anything explicitly released during handoff.

Session config, socket, Chrome temporary state and selected PDF stay under the
protected private root. No ordinary browser is attached and no cookie/profile
replay or cloud browser is enabled. Agent-browser's domain allowlist is incompatible
with profile/state/CDP replay, so this implementation chooses containment rather
than pretending both modes work. A live daemon may survive a worker reconnect;
a closed/crashed daemon loses its remote form state. Explicit Resume re-observes
or opens a fresh form. Old acknowledged progress is not proof that a reopened
page still contains values: re-inspect and deliberately refill. Uncertain actions
pause rather than blindly replay. No exactly-once remote-effect guarantee exists.

One active session per workspace, 100 observed controls, two-minute observation
freshness, 35-second CLI action deadline and bounded output apply. Commands are
typed JSON over stdin, not interpolated shell strings. No page/model script is
executed; evaluation is restricted internally to fixed trusted observation/guard
scripts. Page text is untrusted evidence. Do not expose the loopback app publicly.

## Install And Test

From maxim/app with the pinned Node on PATH:

~~~powershell
npm ci
node node_modules/agent-browser/bin/agent-browser.js install
node --import tsx --test tests/unit/browser-executor.test.mjs
node --import tsx --test tests/integration/browser-assistance.test.mjs
node node_modules/@playwright/test/cli.js test tests/e2e/browser-assistance.spec.mjs
~~~

The integration/UI checks require Docker Desktop, a production build and spare
disk capacity. Use an external private test TEMP directory if C: is constrained;
placing test private roots inside the repository is intentionally refused.
`MAXIM_BROWSER_HEADED_TEST=1` exposes the same native Chrome in isolated tests.
No production credentials, candidate data or employer POST is needed by fixtures.

See [current verification](../../roadmap/reviews/mvp-completion-verification.md).
