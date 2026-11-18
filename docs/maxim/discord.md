# Durable Discord Delivery

The S8 service, worker, workspace view and migration are integrated. Open Discord
in the workspace. Current evaluation and consented Gmail/networking ready-task
producers feed the same durable queue. The final combined suite awaits Docker
recovery; no live Discord smoke is claimed. No real webhook was read, configured
or contacted. Delivery remains disabled until the owner explicitly configures it.

## Private Setup

Use the existing private maxim applier channel. No bot, new account, new server,
or channel-creation permission is needed. Do not paste credentials into chat,
repository configuration, agent messages, screenshots, shell arguments or .env.

After a reviewed backup and normal launcher migration:

1. Sign in as the local owner and open Discord delivery settings.
2. Privately enter the existing webhook and channel ID. Confirm that this is the
   existing destination. Saving performs **no HTTP request** and leaves delivery
   disabled. This is human destination confirmation, not remote verification.
3. Select exact content categories and use Preview only. Preview is a read-only
   database transaction: no POST to Discord, command, event, outbox, attempt,
   accepted fingerprint or schedule mutation occurs.
4. Approve those contents for that destination and explicitly enable delivery.
   Enablement itself queues nothing. Only explicit queue actions, configured due
   schedules, integrated domain producers, or consented ready-task producers can
   enqueue subsequent work. No automatic live smoke is part of setup/tests.
5. Configure IANA timezone, anchor date, local time and enabled state separately
   for daily application batches, weekly review and 21-day Saturday resume/PDF
   review. Schedule configuration alone cannot authorize delivery.

If a live smoke is desired later, obtain separate explicit approval of the exact
destination and previewed content, then queue one notification. A response means
HTTP acceptance, not that a person read the message. No such smoke ran here.

Secrets are immutable, opaque UUID files under `<privateRoot>/discord/`, inheriting
the existing protected private-root ACL. Mode 0600/0700 is also requested on
platforms supporting it. This is not encryption against administrators or the
same Windows account. PostgreSQL holds only a secret reference, destination hash,
revision and consent. Public reads, command results, events and attempts contain
neither webhook nor channel ID. Secret-bearing commands store a request hash,
not the raw request. There are no provider/body error logs.

No shared config extension or environment variable is required. Production
accepts only `https://discord.com/api/[v10/]webhooks/<id>/<token>` without query,
fragment or userinfo. Test mode accepts only an HTTP 127.0.0.1 fixture webhook
and refuses production Discord URLs. Existing .env webhooks are never imported.
Redirects are refused. Missing/deleted private files report unconfigured and
cannot cause a send to a fallback destination.

Replacing a destination disables delivery, clears consent and cancels queued
work. In-flight requests become uncertain and their late responses cannot publish
acceptance. Changing consent also cancels old queued work. Re-enabling advances
schedules to their next future tick; it never sends an offline consent backlog.
Restore private credentials separately from DB backups; they are not part of the
existing artifact backup inventory. Review consent and keep workers stopped
until restore configuration/destination have been checked.

## Delivery Semantics

`discord_notifications` persists identity, kind/entity, payload revision,
destination hash/revision, planned due/available time, sanitized payload, attempt
count, status and acceptance. `discord_attempts` records every initiated POST,
lease token, HTTP status, safe error code and retry timing. `work_items` supplies
the existing worker fencing/claim contract. Events and notification/work rows
are inserted in the same PostgreSQL transaction as producer work when the enqueue
adapter is called inside that producer transaction. HTTP is never transactional.

States are pending, sending, retry, accepted, uncertain, failed and cancelled.
Only a valid HTTP 200 `wait=true` response with a message ID and the privately
confirmed channel ID is accepted. A 204 or malformed success is uncertain, not
accepted. Accepted identities suppress known replay; pending/retry identities
refer to the existing retryable record, not a permanent accepted fingerprint.

429 uses the maximum valid Retry-After, reset-after and JSON retry_after hint,
plus exponential backoff (5, 10, 20, 40, 80 seconds). Hints over 24 hours or invalid
hints stop automatic retry instead of retrying earlier than a server cooldown.
5xx has bounded backoff. Redirects and other non-success statuses stop automatic
retry. Rejected deliveries with remaining budget have an explicit owner-only
Retry rejected delivery action; they are not permanent accepted fingerprints.
There are at most five initiated POSTs per notification, including operator
retries. The worker stores cooldown in PostgreSQL, has a courtesy two-second
destination pacing interval and uses a ten-second total HTTP/body deadline.
It does not depend on the parent's renewal lasting longer than 80 seconds.
Before recording a sending attempt, a `clock_timestamp()` check requires at
least twelve real seconds of lease headroom. Transaction-stable `now()` cannot
authorize a POST after slow planning has consumed the lease.

Timeout, disconnect, aborted request, expired lease or crash after a possibly
accepted request is **uncertain**. Recovery does not automatically POST again.
The owner can cancel, or choose Retry; may duplicate. Retry requires current
consent, unchanged destination, an explicit duplicate-risk acknowledgement and
a remaining attempt. It never marks an unverified prior response accepted.
A wrong-channel success disables delivery and remains uncertain. Worker failure
before any send is shown as failed, rather than leaving a permanently pending row.

Fencing checks the current work token, owner, unexpired lease, notification token
and consent/destination revision before publishing. Changing consent during HTTP
cannot recall an already transmitted request. A stale worker cannot mark it
accepted. 5xx retries and manually retrying uncertainty can duplicate a message
whose remote side effect was not observable. **Exactly-once delivery is not
claimed.** IDs/fingerprints are local; Discord webhook execution has no atomic
transaction with this database.

## Content And Schedules

Payloads contain fixed text and aggregate numbers only. No employer/role text,
candidate information, email/contact details, mail/JD bodies, notes, tokens,
artifact content, posting URLs, private/public artifact links or attachment paths
are copied. Mentions are disabled and embeds suppressed. No Discord action can
approve a packet/answer or submit an application. This adapter sends notifications,
not recruiter messages, bot replies or application submissions.

Confirmed-submission counts require a canonical application with an actual
`applied_at` at/before the snapshot and a `submitted_snapshot.source` of
`user_declaration`, in a submitted/downstream outcome. Discovered, evaluated,
filled, reviewed, legacy-unconfirmed, reversed and unknown records do not count.
Application review counts active unsubmitted application intents whose jobs are
not archived. Notifications re-plan immediately before POST; resolved queues or
changed queue identities cancel instead of sending old reminders.

Fresh high-fit alerts require the latest completed Career-Ops evaluation, T2/T3
retained tier and score, current job/candidate/policy/review revisions, canonical
candidate authority, current engine hash and no invalidated evidence. Retained
policy must allow the role and mark it eligible/urgent. The posting must have a
real provider `first_published`/`publishedAt` observation, within 48 hours and not
in the future, matching the canonical posting time. The observation must be
within 24 hours, from an enabled S4 source and completed/partial run without an
identity conflict. Unknown, updated-at-only, first-seen, dismissed, submitted or
stale evidence cannot establish freshness. No independent fit score is produced.

Schedules retain timezone, wall-clock time, explicit anchor, next due time and
last coalesced slot. Daily and weekly intervals are 1/7 calendar days. Resume
reviews are 21 calendar days anchored on Saturday, not 504 UTC hours. A DST gap
runs at the first valid minute after the gap; a fold chooses its first occurrence
only. Missed ticks coalesce to the latest eligible slot, and advance atomically
to the next future slot. Older unsent retries for the same schedule kind are
cancelled. No restart storm of every missed tick occurs. Attempt/cooldown data
survives worker process restart.

## Optional Producer Contract

There is no query against stale SQLite and no assumption that S7/S9 exists.
The fixed producer-owned tables/views below are intentionally absent unless
their owning stage explicitly supplies and verifies them:

| Relation | Allowed kinds |
| --- | --- |
| `public.discord_s7_ready_tasks` | `needs_response` |
| `public.discord_s9_ready_tasks` | `networking_review`, `recruiter_reminder` |

Required columns: `workspace_id uuid`, `task_id uuid`, `revision integer`,
`kind text`, `status text`, `due_at timestamptz`. A ready task has `status='pending'`
and `due_at <= snapshot time`; all resolution/correction/revocation must disappear
from that ready set. The view is the producer's stage/evidence gate, not a view
over drafts that merely look due. S7 must enforce its reviewed mail consent and
unresolved Needs Response semantics; S9 must enforce current manual task state.
Do not expose bodies, names, addresses, contacts, artifact links or draft text.

S8 checks relation/column existence first; absent contracts are unavailable, not
empty success. Fixed aggregate queries filter workspace, status, due time and
kind. Counts are exact and deduplicate task IDs; task-set hashes suppress replay
even if a resolved task event is replayed. Once both a producer contract and
explicit content consent exist, the bounded tick enqueues due batches. Delivery
rechecks that the exact pending set still exists. No mail access or networking
send permission is inferred from destination consent. These views require parent
coordination; this lane does not create them or claim S7/S9 acceptance.

## Exact Parent Integration

No shared file was edited by this lane. The existing migration runner discovers
`008_discord.sql` with its underscore regex. Do not edit the runner or execute a
production migration before the complete build/tests and reviewed backup.

In `src/server/http.ts`, after the existing authenticated `ctx`:

```ts
import {discordView, discordPlan, discordCommand} from './integrations/discord';

if (get && name === 'discord') return json(await discordView(ctx));
if (post && name === 'discord/plan')
  return json({result: await discordPlan(ctx, await body(req))});
if (post && name === 'discord/commands')
  return json({result: await discordCommand(ctx, await body(req))});
```

Keep current Host/Origin/CSRF, body limit, no-store and DomainError handling.
Services recheck current owner/session scope; mutations additionally use the
existing command transaction's reauthorization, idempotency and revision checks.
Do not expose consent, destination setup, queue or retry mutations as model tools.
Agent access can use only owner-scoped `discordView`/`discordPlan` read paths.

In `src/worker/main.ts`:

```ts
import {deliverDiscord, tickDiscord} from './discord';

// In executeWork, before unsupported_work:
if (item.kind === 'discord_delivery') return deliverDiscord(item, signal);

// Inside the existing guarded worker loop, before claimWork:
await tickDiscord();
```

The tick is bounded to three due schedules and twenty abandoned sending rows;
optional task categories are three fixed aggregate checks. Concurrent ticks use
the settings lock and deterministic identities. The adapter uses the existing
privateRoot/testMode/database config; `config.ts` needs **no changes**.

In the parent's selected settings/view location:

```tsx
import {DiscordView} from './discord';

<DiscordView api={api} disabled={disabled} asOf={asOf}/>
```

This does not require a new Navigation type if mounted inside Settings. If the
parent adds a top-level view, it owns the corresponding workspace/types/menu
changes. The component uses existing Astryx/Lucide primitives and CSS classes.

For automatic high-fit events, call after a valid evaluation is completed and
before committing its existing domain transaction (no separate post-commit POST):

```ts
import {enqueueDiscordEvent} from '../server/integrations/discord';

// After careerops_evaluation_finished, before projection/finishWork:
if (!invalid) {
  await enqueueDiscordEvent(tx, item.workspace_id, {
    kind: 'high_fit', entityId: e.job_id,
  });
}
```

Use the appropriate relative import at the producer site. Leave the optional
`eventKey` unset for domain producers so the planner owns replay identity;
`schedule:` keys are reserved for the scheduler. Application queues are batched
through their daily schedule, not one notification per filled form. Until the
parent wires the evaluation call, high-fit delivery is available only through
explicit plan/queue actions.

The existing `maxim/scripts/discord-notify.mjs` already rejects canonical
application ownership before SQLite planning, and records its legacy fingerprint
only after HTTP success. Its loopback 429 regression passed unchanged. Keep that
canonical gate; do not turn this S8 lane into a fallback to its .env webhook.
No parent legacy-notifier edit is required for this observed gate.

## Verification And Limits

From `maxim/app`, with pinned local Node, Docker and Playwright Chromium:

```powershell
.\node_modules\node\bin\node.exe --import tsx --test tests/unit/discord.test.mjs
.\node_modules\node\bin\node.exe --import tsx --test tests/integration/discord-delivery.test.mjs
.\node_modules\node\bin\node.exe --import tsx node_modules/@playwright/test/cli.js test tests/e2e/discord-settings.spec.mjs --output "$env:TEMP\maxim-test-discord-ui-results" --reporter=list
.\node_modules\node\bin\node.exe node_modules/typescript/bin/tsc --noEmit --incremental false
```

The Discord-specific fixture creates a uniquely named PostgreSQL 18.1 container,
loopback listeners, `maxim_test_*` database and temporary privateRoot. It applies
the real migration runner and never falls back to production config. It executes
the actual service/worker code, including real killed/restarted worker processes.
The UI fixture bundles the actual component with the current Astryx theme and
serves authenticated service calls in a fixture HTTP adapter, because shared
production route wiring belongs to the parent. It is not proof that those routes
or navigation have been integrated. Playwright is used for tests only, not as a
production browser executor. Screenshots are synthetic fixture data only.

Observed 2026-11-17: 4 unit checks, 17 PostgreSQL integration checks and both
1600px/390px component browser tests passed. Desktop/mobile screenshots were
inspected. The existing legacy 429 regression also passed. Full-tree typecheck
initially reported only concurrent interview/networking/browser lane errors;
no Discord diagnostics were present. After the parent fixed those concurrent
errors, the latest full-tree typecheck passed. Full production build acceptance
and runtime integration remain parent responsibilities. No shared build was run
over concurrent lane output.

No production DB was migrated, no webhook or .env was read, no real Discord
request occurred, no consent was inferred, and no Git operation was performed.
No formal independent EGM review or complete S8 acceptance is claimed. Live
setup remains blocked on private user configuration/approval and parent wiring.
