# S7: Gmail evidence and response tasks

**Status:** Pending implementation. Detailed plan drafted; no acceptance criterion is claimed passed.
**Updated:** 2026-11-16.
**Roadmap:** [Stage index](README.md) | [High-level roadmap](../high-level-roadmap.md) | [Shared contracts](contracts.md)
**Requires:** [S5](stage-05-evaluation-and-tracker-cutover.md)

> **How to pick this up:** Implement only this file's Scope and Acceptance, in the ordered slices below. Existing paths are evidence, not a promise of compatible behavior. Proposed files/tests do not exist until implemented. Dependencies require their own recorded proof; planning status never satisfies them.

## Objective

Observe consented job-related Gmail communication, link it to applications with evidence, and track response tasks without automatic sending or ambiguous lifecycle updates.

## Thin Vertical Slice

- **Narrowness axis:** one account, read-only processing, one definite thread match and one ambiguous thread.
- **E2E path:** connect/consent; worker observes a selected thread; user confirms application linkage/task; repeated ingestion is idempotent; revoke access and correct a wrong match.
- **Counterexample:** another candidate's email, revoked credential or a company-only match cannot change the wrong application.
- **Outside this slice:** Gmail sending/modify/calendar scope, all-mail classification by default, other mail providers.

## Current Evidence And Boundary

Existing [manual recruiter inbox](../../maxim/lib/recruiter-inbox.mjs) stores manually created tags/Needs Response. It is not a Gmail adapter. An assistant-connected Gmail service also is not a repository-owned integration.

S5 already supplies application IDs/outcomes and transactional commands; S2 supplies worker leases. Do not create a mail-owned tracker or bypass these services.

## Scope And Contracts

- Choose repository-owned OAuth/authorized product connection, actual least-privilege read scope, protected tokens, user-visible account and revoke/disconnect lifecycle.
- Explain that the grant may allow broad mailbox reads even when Maxim selects only job-related messages; define selection, retention and model-disclosure consent.
- Persist provider account/message/thread IDs, observation checkpoints/watermarks, content revision and source links. Resume/retry/backfill within explicit bounds; a stale cursor must not become successful up-to-date state.
- Link using reliable identifiers and current application context; company/title-only ambiguity produces reviewable unassigned evidence. A model suggestion is not outcome proof.
- Create/correct/resolve response tasks through canonical commands. A later ingestion of old mail must not revive an already resolved task.
- Keep source observations separate from accepted status changes; record confidence/reviewer/evidence and correction effects. Submitted outcome is not inferred from generic recruiter mail.
- Show account state, last successful check, stale/error, linked/unassigned evidence and Needs Response in UI/agent. Do not leak body text in notifications/logs.
- Make outbound sent-message observations, if used to resolve a task, attributable and current; this does not add a send tool.

## Ordered Implementation Slices

| Slice | Action | Result |
| --- | --- | --- |
| MAIL-A | Account consent/token/revocation and bounded read adapter | Explicit permissions and failure state |
| MAIL-B | Worker ingestion IDs/checkpoints and private retention | Restart/retry without duplicate observations |
| MAIL-C | Correlation and human correction/task commands | Confirmed vs uncertain match distinction |
| MAIL-D | UI/agent evidence/task views and privacy tests | Source-linked response state on the same application |

## Acceptance

- [ ] **MAIL-01:** Only the explicitly consented account/read operations run; raw tokens remain protected and model/body disclosure follows consent.
- [ ] **MAIL-02:** Re-ingestion/retry/restart produces one observation per source revision and preserves bounded checkpoint/backfill state.
- [ ] **MAIL-03:** Definite and ambiguous matches are distinct; company-only or stale context cannot mutate an unrelated application.
- [ ] **MAIL-04:** Confirming/correcting linkage or outcome uses current scoped commands/events; withdrawn evidence is reflected without erasing historical provenance.
- [ ] **MAIL-05:** Response tasks clear on attributable reply/manual resolution and old replay cannot reopen them incorrectly.
- [ ] **MAIL-06:** Revoked/expired access, invalid cursor, timeout/quota and worker lease loss are visible and cannot publish stale/unconsented content.
- [ ] **MAIL-07:** UI/agent and source links agree after restart; second identity cannot enumerate mail or integration metadata.
- [ ] **MAIL-08:** No send/modify/calendar tool is registered; private bodies/tokens are absent from Git, public traces, screenshots and default Discord payloads.

## Integration Test

**Proposed:** `node --test maxim/app/tests/integration/gmail-evidence.test.mjs` and `maxim/app/tests/e2e/gmail-evidence.spec.mjs`.

Use S1-S5 actual service/worker/DB with a scripted mail provider. Include duplicate source IDs, wrong/ambiguous employer match, correction after a proposed update, reply-task replay, revoked credential, expired cursor and changed consent between enqueue and execution.

A separately consented live read/revoke smoke is required only when Gmail is claimed live. Never use the user's inbox as a fixture or automatically send a test message.

## Files Changed

~~~text
maxim/app/src/server/integrations/gmail/          account adapter/consent/checkpoints
maxim/app/src/server/{evidence,response-tasks}/
maxim/app/src/worker/gmail.ts
maxim/app/src/app/                               integration/inbox/application evidence views
maxim/db/postgres/                               connections, observations, links, tasks
maxim/app/tests/{integration,e2e,fixtures}/
docs/maxim/                                     actual consent/revoke/retention setup guide
~~~
Concrete provider registration/key names follow the selected authorization path; an assistant plugin connection is not silently reused as a product credential.

## Dependencies And Handoff

Requires S5. Produces **mail-evidence** and **response-tasks**. S8 needs this stage only for mail-driven notifications; job/progress notifications do not wait on Gmail. S9 uses live mail evidence only if included.

## What Shipped

Pending. No account authorization or message access occurs during planning.

## Deferred To Later Stages

Sending replies, calendar, other mail providers, broad mailbox automation, glasses and automatic action from ambiguous language.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
