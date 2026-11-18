# Networking, History And Analytics Workspace

Updated: 2026-11-17 (America/New_York).

## Delivery Boundary

S9 implementation is confined to new networking service/component/migration/test
files. It does not inspect or migrate personal files, contact databases, mail or
production credentials. It does not change the stage manifest or native pure
libraries. Existing native contacts/history are not silently cut over: imported
workspace records have their own explicit PostgreSQL IDs and source mappings.
No SQLite writer, two-way synchronization, platform executor, LinkedIn login,
scraping, publishing, message send, automatic submission or external research
request is added. Research is supplied and reviewed by a person; opening an
evidence link and exporting are explicit browser actions.

The main authenticated dispatcher, workspace navigation and privacy-minimized
agent read are now integrated. Open Networking for Contacts, Draft Queue, History,
Recruiters and Analytics. The combined production build passes; the final mounted
integration/UI rerun awaits Docker recovery. The standalone module checks are
not a claim that personal imports have been migrated or live networking performed.

## Implementation Wiring (Already Applied)

### HTTP

In `maxim/app/src/server/http.ts`, import:

```ts
import {networkingRoute} from './networking/routes';
```

Immediately after the existing `const ctx=await authenticate(req,post);`:

```ts
const networking=await networkingRoute(req,ctx);
if(networking)return networking;
```

The existing dispatcher must retain its Host, Origin, session and POST CSRF
checks. Do not route untrusted caller-supplied contexts around authentication.
The networking route owns bounded body parsing, no-store responses and errors.
POST commands/imports return **`{result: ...}`**, matching other workspaces.

### Workspace

In `maxim/app/src/components/maxim/types.ts`, add `'networking'` to `View`.
In `workspace.tsx`, add `Users` to the Lucide import and:

```tsx
import {NetworkingView} from './networking';
// In navigation:
{view:'networking' as const,label:'Networking',icon:Users},
// In the existing view-render conditional:
: view === 'networking'
  ? <NetworkingView api={api} disabled={disabled} asOf={data.asOf}/>
```

After integration, `/maxim?view=networking` uses the existing sign-in and shell.
The component owns its Contacts, Draft Queue, History, Recruiters and Analytics
tabs, empty/error/stale states, revision checks, dialogs and paged import review.
It uses the existing `WorkspaceApi.upload` multipart path; no shared API change.
It uses the existing theme, global styles, Astryx and Lucide. Styles added by this
component also cover its portaled dialogs. No image or marketing page is added.

### Agent

In `models.ts`, import `networkingReadTool` from `./networking/agent` and insert
`networkingReadTool` into the existing exported `tools` array.
In `conversations.ts`, import:

```ts
import {networkingAgentRead} from './networking/agent';
```

Inside `invoke`, after the existing `live` authorization and argument JSON parse:

```ts
if(call.function.name==='read_networking')
  return networkingAgentRead(ctx,args);
```

Strict arguments are `{section:'queue'|'metrics'}`. Queue results contain at most
ten target IDs, job IDs, revisions, actual manual states and current draft
validity. Partial counts are labeled. Metric results contain declared cohort,
aggregate numerator/denominator/exclusions and caveats. Neither result includes
contact names/emails, research text, raw rows, arbitrary segment values or candidate
claims. There is no model-side approval, status mutation or sending tool.
The registered live agent round-trip remains a shared integration test obligation.

### Migration, Worker And Config

The filename is **`maxim/db/postgres/009_networking.sql`**, using underscores so
the existing migration discovery regex finds it. No runner or package edit is
required. No config properties, secrets, worker dispatch/renewal changes or durable
jobs are needed. Native parsing is synchronous and bounded to ten seconds, not an
unbounded task under the eighty-second worker lease. Python with its standard
`csv`, `zipfile` and XML modules is required on PATH; absence fails closed.

Do not apply production migrations as part of this lane. First complete the
parent build and isolated suite, take/verify the normal workspace backup, review
the integration, then let the existing setup/migration path apply the file.
The migration does not require 007/008/010/011 to have been applied first.

## Authorized Import And Provenance

Choose Contacts or History, a stable source key, the supplied file and the explicit
authorization checkbox. A source key identifies the export family, not its current
filename/path. Reusing kind/source/content hash returns the same import. Command
IDs are payload-bound and retained on uncertain UI retries.

Immutable source bytes are stored as bounded PostgreSQL `bytea`, with SHA-256,
original filename, kind, source key and import time. Raw header keys/cell strings
and ordered values are separate from trimmed normalized fields and reviewed
resolutions. Raw-byte download is scoped, attachment-only, nosniff and hash-labeled.
JSON exports are private current-page projections with provenance/links and
partial flags, not full-store backups or public demo data. They do not expose
host paths or raw byte columns. Normal SQL backup includes all raw bytes and
review versions. Raw imports are retained, not automatically expired or deleted;
this slice does not implement a contact/history purge or retention scheduler.

Limits: 2 MiB source, 5,000 records, 64 columns, 100-character header names,
8,000-character cell values, 100 archive entries, 8 MiB expanded bytes, 100:1
maximum compression ratio (with a 1 KiB compressed-entry floor), ten-second native
deadline and bounded native output. UTF-8 CSV supports quoted multiline values,
CRLF, escaped quotes and Unicode. Duplicate/empty headers, extra cells, malformed
quotes and NULs fail atomically. Missing optionals remain unknown, not zero.

Values-only, single-sheet XLSX preserves stored cell values, including unformatted
numeric date serials. Dates are **not** guessed from formatting or locale. Sparse
column/row references are bounded. Formulas, macros, active/embedded content,
external relationships, encrypted/unsupported ZIP entries, duplicate archive
names, symlinks, traversal, entity/DOCTYPE declarations and decompression abuse
are rejected. ZIP contacts imports require exactly one `Connections.csv` or
`contacts.csv`; a short LinkedIn Notes preamble is supported. No archive entry is
extracted to a filesystem path. The native stdlib parser replaces the unsafe
boundary of the legacy XLSX helper without importing its filesystem-writing API.

Contact identity is source-scoped explicit ID, profile URL, email, or a hash of
the exact raw fields when stronger identity is absent. Names alone never merge
contacts. A revised identity-less row may need manual reconciliation; different
source keys are intentionally not fuzzy-merged. First import never overwrites a
manual correction on rerun. Optional company/title/email/profile/notes/relevance
and explicit alumni/recruiter/founder signals are retained. Strength is only null
or an integer 1-3. Editing a contact uses its exact revision and invalidates
dependent draft reuse through current-evidence checks.

## Research And Manual Workflow

An active current T2/T3 role or an explicit current `connection` priority review
can build a shortlist. A company match or explicit company-specific role relevance
is required before strength, alumni, recruiter or founder signals add points.
Generic engineering/seniority keywords cannot qualify unrelated contacts. Stored
rank reasons cite the actual field/value and points; this is a networking order,
not a competing job-fit score. At most five contacts are shortlisted from at most
5,000 imported contacts. Rebuilding does not replace research, drafts or history.

Review attributable person-specific research and its public HTTPS evidence URL.
Approval records the exact research hash/time. Build using current standard,
nonrestricted approved candidate facts under active canonical candidate authority.
No fallback biography, school, clearance claim or inferred skill is generated.
The five parts are person research, exact role reference, extractive candidate
background, a noninvented fit rationale and a human-selected CTA. Exact fact and
source revisions, job/contact revision, research hash and validation are stored.
Ready/send checks revalidate current evidence; a changed or withdrawn fact cannot
be reused. A reviewed research URL is attribution, not a claim that Maxim fetched
or independently verified its contents.

Drafts start `draft_review`, never silently `ready_to_send`. Human confirmation
records ready and an already completed manual send separately. Manual states
include `ready_to_send`, `sent_manually`, `replied`, `follow_up_due`,
`referral_asked`, `referred`, `declined`, `no_response`. Forward/manual transitions
and events are retained; actioned draft content cannot be regenerated over its
history. Rebuilds and import retries do not reset those states. Referenced fact
corrections label an old draft unusable while preserving its past actions.

Recruiter evidence has source/evidence IDs and observed time. Reply recording
removes Needs Response and adds Responded. Tag correction records a revision,
reason and resolved-through watermark. Duplicate IDs and older observations
cannot reopen or reset resolved/corrected work, even with a new retry command ID.
A genuinely later inbound observation may create new work. This is a manual
adapter; it does not assert Gmail consent, mail ingestion or S7 connectivity.

## History And KPI Contract

Every imported history row starts excluded/unreviewed. Raw Application Status is
soft evidence, never an automatic submitted/interview signal. Explicit review
declares actual submission/date, source-scoped opening/attempt key or exact S5
application/legacy mapping, Interview Round interpretation/date and conflict
acknowledgment. Numeric workbook dates require human interpretation. Interview
Round can support accepted interview evidence only after explicit interpretation;
a status-only Interview cell cannot. Negative/conflicting rounds require review,
not a truthy-string conversion. A row has one immutable attempt identity; another
row mapped to that attempt remains raw and is rejected as a duplicate action.
Historical review corrections are versioned, so as-of queries retain earlier
reviewed interpretations. Existing S5 job/artifact mappings are referenced, not
rewritten or duplicated. No application/report/PDF is imported implicitly.

The KPI counts unique confirmed submitted attempts inside the declared submitted
date cohort and recorded/accepted as-of time. It reuses the Rust NoVA/DC policy:
qualified Virginia cities and DC match; same-named TX/FL cities, Maryland-only,
broad remote and ambiguous locations cannot enter as compatible. Compatible
multi-location records qualify. S5 immutable submission policy establishes known
compatibility when S5 did not snapshot location text. Otherwise the location stays
unknown unless an explicit mapped history review supplies it. Today's mutable job
location, score, networking state or posting date is not silently backfilled into
an old action. A mapped historical attempt and canonical application count once.

The numerator is a subset of that denominator with an accepted reviewed history
interview signal or high-trust S5 user-declared interview/offer action as-of.
A later ordinary rejection does not erase a prior interview. An explicit outcome
correction can retract it or the submission; corrected non-submission wins over
mapped imported evidence. Discovered/evaluated/intent-only records never enter.
Exclusions report duplicate, not submitted, missing submitted date, after-as-of,
outside cohort, unknown location and incompatible location. Unreviewed raw history
is separately counted. Unknown outcome/interview evidence stays visible.

`0/0` has `value:null` and displays Unavailable. Samples below twenty are labeled
small. Maturity defaults to fourteen days; younger attempts are included and
counted as immature, not silently removed or called failures. Cohort endpoints
and as-of must be ordered and nonfuture. Counts/rates are segmented by retained
score band, tier, source, lane, variant, networking, strength and freshness, each
with an explicit unknown bucket. Variant is not inferred from PDF existence;
freshness requires a known posting timestamp at submission, not first-seen or
today's age. No causal recommendations or automatic score/strategy changes exist.

Views are bounded and partial flags are explicit. An aggregate fails rather than
silently truncating above 10,000 combined attempts or 256 distinct location
descriptions. Raw imports have paged row review; arbitrary old target/import
navigation and full multi-format exports are outside this bounded slice.

## Verification

Run from `maxim/app` with its pinned Node. Docker permission is needed only for
the disposable PostgreSQL harness. Never substitute production runtime config.

```powershell
.\node_modules\node\bin\node.exe --import tsx --test tests/unit/networking-history-metrics.test.mjs
.\node_modules\node\bin\node.exe --import tsx --test tests/integration/networking-and-metrics.test.mjs
.\node_modules\node\bin\node.exe --import tsx .\node_modules\@playwright\test\cli.js test tests/e2e/networking-and-metrics.spec.mjs --reporter=line --output="$env:TEMP\maxim-test-networking-ui-UNIQUE_RUN_ID"
.\node_modules\node\bin\node.exe .\node_modules\typescript\bin\tsc --noEmit --incremental false
```

Observed in this lane:

- Four pure/native-parser unit cases passed.
- Seven real-PostgreSQL integration cases (including their parent test) passed:
  byte preservation/replay, invalid-strength rollback, isolation/CSRF, explained
  shortlist, five-part evidence checks, stale revisions, persistent manual states,
  recruiter correction retry, exact KPI exclusions/as-of, S5 mapping/correction,
  new service process and isolated SQL backup/restore.
- Two Playwright UI tests passed at 1600x1000 and 390x1000 using the actual
  component, API auth/CSRF, handlers and database. They cover authorized import,
  contact edit, research approval, draft visibility/size, ready/manual send,
  recruiter reply, reviewed history, KPI, refresh persistence and no horizontal
  overflow or browser errors. Synthetic screenshots were visually inspected.
- A rerun initially failed during shared Playwright trace cleanup, not a UI
  assertion; rerunning with a unique temporary output directory passed both tests.
- S9 files had no TypeScript errors. The last full-tree typecheck was blocked by
  a concurrent browser-lane `executor.ts` readonly `NODE_ENV` error. No full
  integrated Next production build, production mount, registered live-agent
  round-trip, native family cutover or formal independent review is claimed.

The test host explicitly mounts handlers after the same auth/CSRF checks and
bundles the real component with the already installed locked esbuild dependency
for a production-mode fixture UI. It creates only `maxim_test_*` PostgreSQL and
`maxim-test-*` temporary private data. It removes its own container/storage and
does not read a personal workbook or production contact. Playwright is used for
tests only; no browser executor is implemented by this lane.
