# Interview Practice (S10 Module)

Updated: 2026-11-17. Integrated optional workspace view, authenticated API,
durable worker and constrained agent tools. Open Interview practice. Final
integration/UI reruns await Docker recovery. No production model call or
implicit account enablement was performed.

## Current Boundary

Project defense, behavioral/STAR and hypothetical system-design practice use a saved
role plus the existing canonical Candidate context. Original prompts are local code;
no external skill/source code was copied, installed or executed. Native Career-Ops
interview-prep and story-bank files are untouched. Career-Ops retains sole fit-score
authority. Practice never becomes candidate truth, an approved answer, a submission,
a hiring probability or a guaranteed employer question.

Optional feedback uses the configured OpenAI model only after explicit per-attempt
disclosure consent. Production transport is restricted to the configured official
OpenAI endpoint; isolated fixtures use loopback only. No request occurs simply by
opening practice or saving a local response. The bounded request compiler,
tokenizer, validation, cancellation and loopback transport are tested. A fixture
does not authorize a real model request or prove live coaching quality. Without
a model key, prompts, local claim warnings and durable attempts still work.

## Workflow

Select a saved role using the built-in Role selector when none is selected, choose
a mode and retention (default 30 days, range 1-365),
then Start practice. Candidate authority must be canonical. Empty approved evidence
stays empty: prompts ask for real examples, personal contribution and missing
measurements. The default selection is at most eight relevant project, experience,
skills or education fields from the existing bounded 20-field Candidate context;
an API caller may select exact IDs/revisions from that same context. Whole
approved values up to 8,000 bytes are eligible; selected evidence is bounded to
14,000 serialized bytes. No summary replaces approved evidence. The selector
lists the recent 100 active roles; an older selected workspace role is retained.
Long omitted
fact values cannot be selected. Source IDs/revisions are visible beside evidence.
Role descriptions are explicitly marked when excerpted at 4,000 characters.

Write a response, label hypothetical/mock content, and save. System-design attempts
are always hypothetical. Local numeric checks warn about unmatched exact reviewed
metrics; these are conservative warnings, not a complete claim verifier. All saved
attempts, including real-sounding declarations, remain unapproved practice.

Requesting feedback requires a separate checked disclosure choice for the attempt,
selected role and reviewed evidence. No model work starts on session creation or
ordinary save. Community intel is explicitly unverified and cannot imply known
employer questions. Stop cancels queued work and aborts in-flight transport. Retry
is an explicit command, never an automatic billable rerun. A session has at most
50 attempts. Its ID and role selection are retained in the URL's `practice` and
`job` parameters, not localStorage.

## Storage And Revocation

`010_interview.sql` creates workspace-scoped sessions, evidence references and
attempts. PostgreSQL is the private storage boundary, included in existing database
backups; this module does not introduce another candidate profile, answer library,
artifact directory or writable native story bank. Session snapshots retain role,
candidate/context and exact fact/source revisions. Attempts retain practice text,
hypothetical state, local warnings, coaching, local accounting, measured provider
usage and explicit terminal failure/cancellation. Each feedback request records its
consent bit and a composite-FK-scoped authorizing session; retries clear old token
accounting before compiling a new request. Command results and events store
IDs/states, not duplicate practice transcripts. No candidate/answer write is exposed.

Database triggers invalidate practice when candidate ownership/revision, referenced
facts/sources or the selected role change. Correction/role changes clear the source
snapshot and feedback; historical user attempts remain marked invalidated and are
never sent again. Withdrawal, increased sensitivity, source deletion or consent
revocation erase dependent attempts, local warnings, source copies and feedback.
Such sessions cannot be revived by regranting consent: start a fresh session.
Checks run again before requests and publication; a 250 ms monitor aborts transport
on cancellation, lost lease, expired authorization or changed evidence. Already
transmitted bytes cannot be recalled from a provider.

Explicit session deletion and expiry erase content and retain opaque audit IDs.
Expiry runs on reads/commands and the parent's periodic worker maintenance hook.
An inactive installation does not claim wall-clock erasure while shut down.
Database backups retain their own private copies until separately removed under the
existing backup policy; deletion is not retroactive backup destruction. No new
encryption, administrator isolation or provider-side deletion guarantee is claimed.

## Bounds And Failure States

One model request per work item, no tools or fan-out, 45-second deadline, 1,024 output
tokens, 32,000 serialized request bytes and the existing local 8,192-token budget.
The pinned Microsoft tokenizer and verified model profiles are reused. Unknown
model IDs use explicit local estimates rather than a name whitelist. The saved
Responses or legacy Chat Completions transport serves feedback through the shared
adapter; task compatibility and output budgets still apply. See [model setup](setup.md#model-selection-and-compatibility).
Mandatory context is not silently trimmed to satisfy the budget. Unknown profiles,
bad JSON, truncation, output bounds and provider rejection fail explicitly.
Transport is bounded to 64,000 response bytes and 16,000 content bytes. Only schema-
validated coaching is accepted. Unknown citations are removed; non-extractive claims
cannot be upgraded to supported evidence merely because the model says so.

Local estimates and provider-reported token usage are separate. No exact billing
claim is made. Expired leases become interrupted, not completed; max attempts is
one to avoid hidden provider retries after a worker crash. No candidate code,
uploaded scripts, shell tools or copied skill workflows can run through practice.

## Implementation Wiring (Already Applied)

No runtime config, dependency or package-script addition is required. Keep the
filename `010_interview.sql`: it matches `/^\d{3}_[a-z_]+\.sql$/`. Parent owns
migration/build/backup activation; do not run production migrations from this lane.

In shared `server/http.ts`, import and dispatch before the final 404:

```ts
import {interviewHttp} from './interview/http';
// Inside handle(), before the final 404:
if (route[0] === 'interview') return interviewHttp(req);
```

The handler applies existing Host, session, Origin and CSRF checks, bounded JSON,
no-store reads and the normal `{result: ...}` command wrapper. Endpoints:
`GET /api/interview?job=<uuid>&session=<uuid>` and
`POST /api/interview/commands`. Actions are `start_session`, `save_attempt`,
`request_feedback`, `cancel_feedback`, `delete_session`. Every mutation uses an
idempotency UUID and expected current session/role/candidate revision as applicable.

In `worker/main.ts`:

```ts
import {practiceInterview} from './interview';
import {expireInterviews} from '../server/interview/service';
// Inside executeWork(item, signal):
if (item.kind === 'interview_feedback') return practiceInterview(item, signal);
// In the existing periodic maintenance block:
await expireInterviews();
```

In `components/maxim/workspace.tsx`, import `InterviewView` from `./interview`,
add `{view:'interview' as const,label:'Interview practice',icon:MessageSquare}` to
navigation, and add `'interview'` to the shared `View` union in `types.ts`. Insert
this render branch next to Answers, using existing workspace variable names:

```tsx
: view === 'interview' ? <InterviewView key={jobId}
    api={api} disabled={disabled}
    job={data.jobs.find(j => j.id === jobId) ?? null}
    asOf={data.asOf} refresh={refresh} onDirtyChange={setNoteDirty}/>
```

Role/application entry buttons should invoke the existing
`navigate({view:'interview',job:job.id})`, using their selected job record. When
changing jobs in `rawNavigate`, clear an old role's practice selection:

```ts
if ('job' in selection && selection.job !== jobId) params.delete('practice');
```

The optional `onDirtyChange` connects unsaved practice text to the existing
navigation guard. The component independently guards page unload and switching
sessions. No private browser persistence is added.

Agent integration: import `interviewTools` from `./interview/agent` in `models.ts`
and spread `...interviewTools` into its existing tools array. In
`conversations.ts`, import `interviewTool` from the same module and dispatch inside
`invoke()` immediately after parsing `args`:

```ts
if (['start_interview_practice', 'read_interview_practice'].includes(call.function.name))
  return interviewTool(ctx, rid, call.function.name, args);
```

The start tool requires an exact current live-run request naming practice/rehearse,
the mode and role UUID. It calls the same command service and returns only IDs and
the role-linked URL. It does not request model feedback. Read returns scoped status
summaries, never private attempts/feedback or source text into conversation history.
Add this policy sentence while preserving the existing restrictions:

```text
Explicitly requested private interview-session creation and status reads use start_interview_practice and read_interview_practice only; they cannot request model feedback, execute code, approve facts or answers, or treat practice text as candidate truth.
```

Full parent routing/navigation/
agent composition must be tested after applying these snippets.

## Isolated Evidence

Run from `maxim/app` using the pinned Node binary:

```powershell
.\node_modules\node\bin\node.exe --import tsx --test tests/unit/interview-policy.test.mjs
.\node_modules\node\bin\node.exe --import tsx --test tests/integration/interview-practice.test.mjs
.\node_modules\node\bin\node.exe --import tsx .\node_modules\@playwright\test\cli.js test tests/e2e/interview-practice.spec.mjs --reporter=list
.\node_modules\node\bin\node.exe .\node_modules\typescript\bin\tsc --noEmit --incremental false
```

Measured 2026-11-17: unit 4/4, integration 13/13, component browser test 1/1.
Full application TypeScript checking also passed after the concurrent browser-lane
type error was resolved by its owner. No production application build was run in
this lane; the parent owns the final integrated build/backup/migration gate.
The integration deadline case observed about 45.2 seconds. Fixtures create a new
`maxim_test_*` database in a disposable `maxim-test-*` PostgreSQL 18.1 container,
synthetic identities/evidence, protected temporary runtime and loopback provider.
They refuse an inherited runtime selector and never read a production config.
Only baseline migrations 001-006 plus 010 are applied, to isolate this lane from
concurrent S6-S9 work. The fixture applies real SQL and runs the actual interview
HTTP handler, command service, model compiler/parser and leased worker. It tests
agent exact-request gating, rollback/replay, two identities, disclosure filtering,
all modes, real DB/server restart, local/provider accounting, unconfigured model,
budget/profile denial, provider failures, deadline, cancellation, correction,
revocation, lost lease, expired auth, retention and erasure. Canonical facts and
answer memory remain unchanged by practice.

The browser test bundles the actual React component with existing Astryx theme/CSS
and uses those real fixture HTTP/DB services. It verifies desktop/mobile, keyboard,
no-selection role picking, reload/URL resumption, model cancellation, empty-key
usefulness, last-loaded-data/disabled mutations during an HTTP outage, no
localStorage, and deletion. Desktop/mobile screenshots were visually inspected
and showed no clipping or overlap. Playwright is used only as an automated test executor, not a product
browser runner. Final mounted-app verification is recorded separately.
Full app typecheck/build is a shared-tree gate; unrelated concurrent failures are
reported separately and are not silently repaired or called passed. No live model
quality evaluation, independent EGM review, production backup or migration occurred.
