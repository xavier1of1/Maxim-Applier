# S8: Durable existing-Discord delivery

**Status:** In progress. Implementation integrated; final acceptance gates remain open.
**Updated:** 2026-11-17.
**Roadmap:** [Stage index](README.md) | [High-level roadmap](../high-level-roadmap.md) | [Shared contracts](contracts.md)
**Requires:** [S5](stage-05-evaluation-and-tracker-cutover.md)

> **How to pick this up:** Implement only this file's Scope and Acceptance, in the ordered slices below. Existing paths are evidence, not a promise of compatible behavior. Proposed files/tests do not exist until implemented. Dependencies require their own recorded proof; planning status never satisfies them.

## Objective

Deliver useful canonical progress and high-fit notifications reliably to the existing maxim applier Discord, with persisted schedules and honest delivery state.

## Thin Vertical Slice

- **Narrowness axis:** one privately confirmed destination, one job alert, one digest and one failure/retry schedule.
- **E2E path:** event schedules a redacted notification; worker attempts delivery; mocked 429 fails without accepted suppression; retry succeeds; restart preserves next run; counts match confirmed applications.
- **Counterexample:** unknown HTTP outcome, stale posting date or replay cannot become claimed exactly-once delivery or a fabricated fresh-role alert.
- **Outside this slice:** a new Discord server, broad bot commands, application approval by Discord or wearables.

## Current Evidence And Boundary

[discord-notify.mjs](../../maxim/scripts/discord-notify.mjs) inserts a fingerprint before POST and does not validate HTTP acceptance. Its [429 fixture](../../maxim/tests/integration/discord-notification-delivery.test.mjs) fails after proper sandbox access. A manual webhook command is not a recurring scheduler.

[Notification planner](../../maxim/lib/notification-planner.mjs) has useful templates/dedupe ideas; adapt semantics, not premature accepted-delivery bookkeeping.

## Scope And Contracts

- Reuse the user-confirmed maxim applier destination. Resolve only private configured channel/webhook references; no hardcoded URL/token or invented account recreation.
- Start with outbound webhook if sufficient. Keep assistant-connected bot permissions separate; interactive bot commands need a later explicit scope.
- Persist notification identity/type/entity/payload revision/destination, planned due time, attempts, status and remote acceptance/uncertainty. Event enqueue is atomic; HTTP is not.
- Validate non-success responses, bounded backoff/retry hints and lease ownership. Accepted suppression follows acceptance policy, not mere planning. Unknown outcome may duplicate on retry; expose/document the choice.
- Add urgent fresh T2+ only with eligibility and trustworthy posted-time evidence; unknown/future timestamps do not qualify. Fresh automated-discovery claims require S4.
- Batch application-review queues first. Networking draft/shortlist and manual recruiter reminders require S9; mail-driven Needs Response requires S7. Neither pending producer is assumed present.
- Implement durable weekly review and 21-day Saturday resume/PDF review when configured, with explicit timezone/anchor/time. Missed schedules coalesce safely rather than spamming every missed tick after restart.
- Keep dry-run completely side-effect-free for delivery and accepted fingerprints. Preserve redaction and avoid public/private artifact URLs or unnecessary candidate/mail content.

## Ordered Implementation Slices

| Slice | Action | Result |
| --- | --- | --- |
| NTF-A | Destination/content/timezone/schedule configuration | Existing channel reused, opt-in contents |
| NTF-B | Outbox/attempt/acceptance/uncertainty adapter | Failed send never accepted |
| NTF-C | Durable schedule/lease/retry/coalescing | Restart/backoff behavior proved with fake clock |
| NTF-D | Planner event eligibility + batching + settings/delivery UI | Canonical counts and actionable status |
| NTF-E | Legacy notifier repair/gate and consented private smoke | No old buggy path silently bypasses new delivery semantics |

## Acceptance

- [ ] **NTF-01:** Correct existing private destination is used; missing secret/config gives dry-run/unconfigured state without leaking value or creating another server.
- [ ] **NTF-02:** HTTP 429/non-success/network failure is not accepted/deduped permanently; attempts and bounded retry remain visible.
- [ ] **NTF-03:** Accepted delivery suppresses known replay; crash-after-acceptance/unknown outcome follows a documented uncertainty/duplicate policy without exactly-once claims.
- [ ] **NTF-04:** Urgent T2+ eligibility uses retained score/policy and real posting freshness; unknown/future dates and unsupported source coverage are not declared fresh.
- [ ] **NTF-05:** Batch/weekly/21-day Saturday schedules survive worker restart, timezone/DST and missed-run coalescing with a configured anchor.
- [ ] **NTF-06:** Digests count confirmed submitted applications and current unresolved tasks, not discovered/evaluated/filled records; resolved-task replay does not notify again.
- [ ] **NTF-07:** Dry-run makes no POST or accepted delivery mutation; payload/logs reveal no webhook, token, private body, contact details or artifact content.
- [ ] **NTF-08:** Settings/status in UI/agent agree with persisted outbox; legacy notifier is repaired or gated, and optional Gmail-driven content is disabled until S7 evidence exists and networking/manual recruiter content until S9.

## Integration Test

**Existing regression:** `node --test maxim/tests/integration/discord-notification-delivery.test.mjs`. It uses a loopback mock, not real Discord, and currently fails the retryable-fingerprint expectation.

**Proposed:** `node --test maxim/app/tests/integration/notification-delivery.test.mjs` plus `maxim/app/tests/e2e/notification-settings.spec.mjs`.

Exercise actual worker/outbox path with fake clock and loopback server: success, 429, server failure, timeout, accepted-then-crash, duplicate event, destination change, stale eligibility and restart. Count actual requests and accepted records independently.

Live smoke requires explicit destination/content approval and a configured local secret, after dry-run/retry proof; never run real sends as automatic test setup.

## Files Changed

~~~text
maxim/app/src/server/{notifications,schedules}/
maxim/app/src/server/integrations/discord/
maxim/app/src/worker/{notifications,schedules}.ts
maxim/app/src/app/                               settings/delivery history/progress views
maxim/db/postgres/                               outbox/attempt/schedule migrations
maxim/scripts/discord-notify.mjs                 repair or canonical adapter/gate
maxim/app/tests/{integration,e2e,fixtures}/
docs/maxim/                                     actual webhook/schedule/runbook
~~~
Retain native/manual no-send/LinkedIn boundaries. A notification worker never becomes the source of application truth.

## Dependencies And Handoff

Requires S5. Produces **notification-delivery** and **persisted-schedules**. S4 is conditional for automated fresh discovery claims; S7 for Gmail-driven alerts; S9 for networking/manual recruiter queues. Reuse S2 leases and S1 atomic event/outbox contract.

No new account is necessary; confirm existing destination/config privately. An interactive Discord bot is not needed for the outbound pilot.

## What Shipped

Protected destination/contents approval, previews, durable accepted/uncertain delivery, bounded retry, schedules and current domain/task producers are implemented. Final combined regression and a consented live acceptance smoke remain outstanding.

See [measured MVP verification and remaining gates](../reviews/mvp-completion-verification.md). No unrun acceptance checkbox is promoted.

## Deferred To Later Stages

Interactive bot approvals, reply sending, device/wearable channels, and multiple destination/account management beyond the explicit pilot.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
