# Gmail Evidence (S7)

This is a repository-owned, opt-in, read-only Google adapter, not the assistant's
Gmail connector. Live authorization has not been exercised. Never use a personal
inbox, real credentials or production records as test fixtures.

## Integrated Runtime

The main HTTP dispatcher, durable worker, workspace navigation and read-only
agent tool are now wired. Open `/maxim?view=gmail` after starting the workspace.
Schema migrations are applied by the normal launcher, not by this guide.
The final combined suite is still pending Docker recovery; no live OAuth or
mailbox read has been performed. Follow Local Google Setup below to opt in.

## Implementation Wiring (Already Applied)

The following snippets describe the existing integration points, not steps users
must paste into source. `007_gmail.sql` matches the migration discovery convention.
Back up the private workspace before applying an updated build.

In `src/server/http.ts`, add imports:

```ts
import {gmailCommand,beginGmailOAuth,completeGmailOAuth} from './integrations/gmail/service';
import {gmailView} from './integrations/gmail/reads';
```

After the existing Host check, BEFORE `const ctx=await authenticate(req,post)`:

```ts
if(get&&name==='gmail/callback') {
 const q=new URL(req.url).searchParams;
 try {
  await completeGmailOAuth({state:q.get('state')||'',
   ...(q.has('code')?{code:q.get('code')!}:{}),
   ...(q.has('error')?{error:q.get('error')!}:{})});
 } catch {
  return new Response(null,{status:303,headers:{Location:c.origin+'/maxim?view=gmail&gmail=authorization_failed',
   'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }
 return new Response(null,{status:303,headers:{Location:c.origin+'/maxim?view=gmail',
  'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
```

After authentication, alongside the other scoped routes:

```ts
if(get&&name==='gmail')return json(await gmailView(ctx,Number(new URL(req.url).searchParams.get('offset')||0)));
if(post&&name==='gmail/commands')return json({result:await gmailCommand(ctx,await body(req))});
if(post&&name==='gmail/oauth')return json({result:await beginGmailOAuth(ctx,await body(req))});
```

In `src/worker/main.ts`:

```ts
import {gmailWork} from './gmail';
import {expireGmail} from '../server/integrations/gmail/reads';
// In executeWork(item,signal), before unsupported_work:
if(item.kind==='gmail_sync'||item.kind==='gmail_revoke')return gmailWork(item,signal);
// In the existing periodic maintenance block:
await expireGmail();
```

In `components/maxim/types.ts`, append `'gmail'` to `View`. In `workspace.tsx`:

```ts
import {GmailView} from './gmail';
// Add to navigation (Mail is already a lucide icon; import it if absent):
{view:'gmail' as const,label:'Gmail',icon:Mail},
// Add to the view-render chain before its final fallback:
: view==='gmail' ? <GmailView api={api} disabled={disabled} asOf={data.asOf} navigate={navigate}/>
```

For the agent, add only this read tool to `server/models.ts`'s tool list:

```ts
{type:'function',function:{name:'read_gmail_evidence',description:'Read consented Gmail evidence IDs, human links and response tasks. No account credentials or human confirmation capabilities.',strict:true,parameters:{type:'object',properties:{},required:[],additionalProperties:false}}},
```

And in `server/conversations.ts` add:

```ts
import {gmailAgentView} from './integrations/gmail/reads';
// In the existing tool dispatch:
if(call.function.name==='read_gmail_evidence'){
 toolSchemas.read_workspace.parse(args);return gmailAgentView(ctx);
}
```

No agent mutation, sending, modify, calendar, SQL or arbitrary HTTP tool is added.
`gmailAgentView` excludes addresses, headers and bodies unless current consent
explicitly permits a bounded body excerpt. Mail remains untrusted evidence.

## Local Google Setup

1. Use a separate authorized test mailbox first. Enable Gmail API in your own
   Google Cloud project and configure its OAuth consent screen/test users.
2. Create a **Desktop app** OAuth client. This implementation uses loopback HTTP
   and S256 PKCE. The callback is the current workspace origin plus
   `/api/gmail/callback`; use the actual launcher-selected port.
3. Place `client.json` inside the protected runtime's `gmail` subdirectory, not
   source, an environment dump, chat, or browser storage. The adapter creates and
   ACL-protects that directory on the first connection attempt. Use this shape:
   `{ "clientId": "YOUR_DESKTOP_CLIENT_ID", "clientSecret": "YOUR_CLIENT_SECRET" }`.
   Directory access must be restricted to the current Windows user and SYSTEM.
4. Open Gmail, record the expected account address, one to five exact thread IDs,
   a 1-30 day lookback, and 1-30 day local retention. Review the disclosure checkbox.
   Connect Google account, authorize in the system browser, and return to Maxim.
5. Check selected threads explicitly. There is no background all-mail classifier
   or automatic scheduled sync. Application outcomes are never inferred.

The OAuth grant is exactly `https://www.googleapis.com/auth/gmail.readonly`.
It permits broad mailbox reads even though content retrieval is restricted to
selected threads. Incremental history includes mailbox-wide IDs; unrelated
content is never fetched. Attachments and remote HTML are never fetched/rendered.
Metadata-only mode requests only From, To, Subject, Message-ID and In-Reply-To.
Optional bodies are plain-text MIME parts only, bounded to 16,000 characters;
HTML-only messages have no retained body.

Google's testing-mode refresh-token lifetime, verification/restricted-scope rules
and account policies still apply. These are not bypassed by local operation.
See Google's [desktop OAuth guide](https://developers.google.com/identity/protocols/oauth2/native-app),
[Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), and
[history synchronization guide](https://developers.google.com/workspace/gmail/api/guides/sync).

## Evidence, Corrections And Tasks

An exact current application UUID in retained evidence produces an **identifier
suggestion**, never an accepted link. Company/title-only messages stay unassigned.
Every accepted link requires a human, current application/posting revisions and
a reason. To correct one, withdraw it, confirm the new current link, then explicitly
correct any task. History retains both links and correction events.

Observations do not change submitted/outcome state. Use the existing Applications
`record_outcome` command, its current revision and explicit correction flag for a
human outcome declaration. Withdrawing a mail link flags outcome review; it does
not silently reverse another person's later lifecycle decisions.

Needs Response is human-confirmed per incoming provider message. Resolved/withdrawn
task tombstones survive duplicates, reset/backfill, source revisions and relinking.
Manual resolution needs no Gmail access. Optional reply evidence must be a later
SENT message whose From matches the consented account, on the same thread, with
an exact In-Reply-To matching the source Message-ID. A generic sent message cannot
resolve it. Reply resolution is still human-confirmed; no send operation exists.

## Bounds, Failure And Retention

Each leased work item has a 35-second combined cancellation deadline. A step reads
one initial thread (maximum 25 messages), one history page (maximum 25 history
records/100 references), or up to two selected-message bodies. Each HTTP request
has an 8-second timeout, redirect denial and a 2 MiB response cap. Checkpoints,
observations, continuation enqueue, completion and events commit together behind
the existing work lease and current consent revision. Losing either publishes
nothing. Killing a worker before commit replays that bounded step safely.

A complete sync scans at most 20 history pages. Page/history IDs remain strings.
An expired/invalid cursor, oversized thread/page, quota, timeout, wrong identity or
schema failure stays visible and does not advance a successful watermark. Retry
after the displayed cooldown. Reset bounded backfill explicitly for a lost history
cursor; no silent unbounded rescan or claim of complete mailbox coverage exists.

Disconnect immediately disables ingestion and model disclosure and fences queued
work. A separate `gmail_revoke` item revokes Google's grant, then deletes the token
file. A failed revoke retains the protected token for retry and reports an error;
use Disconnect again to retry. Google Account's third-party connections page is the
manual fallback. Revocation is not a provider-side mail deletion.

Failed-authorization grants whose immediate revocation fails are also retained in
protected files and tracked by `gmail_revocations`. Reconnect is blocked until
that destruction-only work finishes. These cleanup items cannot read any mail
and do not depend on current ingestion consent. A visible pending banner and
Disconnect action provide recovery even after a wrong-account authorization.

Tokens, client credentials and one-use ten-minute state/PKCE secrets live only in
protected local files; DB contains opaque storage UUIDs/state hashes, never tokens.
State is session/account/revision bound and consumed before code exchange. A
callback requires no cross-site Strict cookie; state+PKCE authorize it. Do not
record callback query strings in proxy/access logs or screenshots.

Google's token exchange and local PostgreSQL/filesystem commit cannot be one
transaction. A process crash in that external exchange window may require manual
grant removal in Google Account even when no local connected account exists.

Headers/bodies live in the private local PostgreSQL database, not event payloads,
default notifications or model prompts. Retention starts at first observation;
duplicate reads do not extend it. Expiry removes content and withdraws links/open
tasks while preserving IDs/hashes/provenance. Narrowing consent removes disallowed
content immediately. Purge retained mail content is explicit and irreversible.
Historical IDs, hashes, task decisions, link history and command audit records are
retained. Reasons must describe decisions, not paste private message bodies.
This is local access control, not encryption against the same user/admin/malware.
Existing DB backups retain their own older contents and require separate handling.

## Verification Boundary

The Gmail integration tests use the established isolated Docker/PostgreSQL harness
and injected scripted provider against actual command/read/worker services. Shared
HTTP routing, navigation, agent registration and production worker dispatch remain
parent-owned integration steps. Unit tests drive the actual Google adapter with a
scripted transport; no Google account is contacted. Live read/revoke remains a
separate manual, separately consented smoke test. No live readiness is claimed.

Verified on 2026-11-17 using the pinned Node 24 executable, from `maxim/app`:

```powershell
.\node_modules\node\bin\node.exe --import tsx --test tests/unit/gmail-provider.test.mjs tests/integration/gmail-evidence.test.mjs
.\node_modules\node\bin\node.exe node_modules/@playwright/test/cli.js test tests/e2e/gmail-evidence.spec.mjs --reporter=list --output "$env:TEMP\maxim-test-gmail-e2e"
```

The service/adapter suite covers 17 tests, including a real killed/restarted fixture
worker process, duplicate IDs, partial-history retry, stale/expired cursors, quota,
wrong account, externally revoked credentials, changed consent before/during work,
protected token deletion and failed-revocation recovery, human correction, exact
reply attribution, retention and model/body exclusion. Two Playwright tests render
the actual Gmail component, compiled with the existing pinned transitive esbuild,
against these isolated services. They cover consent, ambiguous/identifier review,
wrong-link/task correction, resolution, reload, offline disabling, revocation and
desktop/390px mobile layout. Synthetic-only screenshots were visually inspected.
The fixture HTTP bridge is explicitly test-only, not a second product API or a
claim that the parent-owned full workspace integration passed.

Final full-repo `tsc --noEmit --incremental false` also passed after the parallel
S6 fix. No production build, migration, OAuth or mailbox smoke is claimed by this
lane. Production deployment still requires the parent's integration checks and
verified backup before migrations.

Downstream mail notifications may consume `gmail_response_required`,
`gmail_response_resolved`, `gmail_response_corrected`, `gmail_link_withdrawn` and
`gmail_source_withdrawn` events. Their payloads contain scoped IDs/status only,
never bodies, sender/subject or tokens. Recheck current `gmail_response_tasks`
status/revision and account consent before delivery; an observation itself is not
an application outcome or permission to notify.
