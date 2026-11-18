# S6: Supported browser application assistance

**Status:** In progress. Implementation integrated; final acceptance gates remain open.
**Updated:** 2026-11-17.
**Roadmap:** [Stage index](README.md) | [High-level roadmap](../high-level-roadmap.md) | [Shared contracts](contracts.md)
**Requires:** [S5](stage-05-evaluation-and-tracker-cutover.md)

> **How to pick this up:** Implement only this file's Scope and Acceptance, in the ordered slices below. Existing paths are evidence, not a promise of compatible behavior. Proposed files/tests do not exist until implemented. Dependencies require their own recorded proof; planning status never satisfies them.

## Objective

Prepare a representative supported application in a visible browser, ask missing questions once, preserve reviewed progress, and give the user a reliable manual submission handoff.

## Thin Vertical Slice

- **Narrowness axis:** representative Greenhouse/Lever variants with explicit control coverage, one dedicated session, one approved packet and one unknown answer.
- **E2E path:** user requests assistance; reviews permitted session/site; executor observes form; fills supported fields and approved PDF; asks unknown; saves approved scoped answer; pauses/restarts/resumes; user reviews final checklist and submits manually.
- **Counterexample:** unknown control/final step, stale reference, hostile page or ambiguous remote action stops safely without a false outcome.
- **Outside this slice:** all ATS/company sites, LinkedIn Easy Apply, Workday-wide support, headless unattended applications or automatic final submission.

## Current Evidence And Boundary

S5 retired the old planner/mapper/browser runner and its registrations/imports. The old [script path](../../maxim/scripts/auto-apply-browser.mjs) is a failure-only retirement notice, not an executor. The [preserved safety scenarios](../../maxim/tests/fixtures/browser-safety-handoff.json) are S6 requirements, not acceptance evidence. Reuse the [canonical S5 lifecycle](../../docs/maxim/application-lifecycle.md), current packet hashes, answer service and scoped commands.

[Native PDF](../../generate-pdf.mjs) and [liveness](../../liveness-core.mjs) behavior stays intact. agent-browser is a reviewed executor candidate, not a product policy engine or guaranteed platform permission.

## Scope And Contracts

- Approve a support matrix by form variant: discover/open, inspect, fill, upload, step navigation, login/session, pause/recover, manual review/final action. Unsupported means manual fallback with the job retained.
- Spike the pinned core executor on the interactive Windows host. Verify daemon/profile/headed behavior and disconnect recovery; no assumption that a Linux Compose service can show a host browser.
- Create per-candidate/application protected dedicated session/profile, single active lease and explicit user login authority. Never attach ordinary browser/CDP by default or expose debugging access.
- Execute typed allowed actions over fresh observations. Bind field/control/frame/origin identity and expected state; unknown navigation or policy change pauses. No arbitrary model script/eval/shell/SQL or page-granted privileges.
- Query canonical fact/answer service and current packet approval; show source/scope and unresolved fields. A new answer is confirmed/reused through S3, not a browser-private cache.
- Allow only the approved artifact as file input; prevent paths to .env, cookies, arbitrary local files or another candidate's upload. Disclose employer autosave/partial-form transmission before filling.
- Persist bounded progress/checkpoints, errors, attachment hash, user edits and uncertainty; redacted logs and screenshots only with explicit safe fixture policy.
- Manual final action is outside the agent surface. Known adapters must test effects and stop before final confirmation; labels alone cannot classify a safe action. Unknown/ambiguous step remains manual.
- Record submitted only through user confirmation/attributable accepted evidence. Review-ready, paused and unknown remote outcome remain distinct.

## Ordered Implementation Slices

| Slice | Action | Proof |
| --- | --- | --- |
| BRW-A | Experience/threat model/support matrix and executor comparison | One chosen reviewed core action subset, no evasion plugins |
| BRW-B | Host session custody + lease + observation/action API | Visible owned session, single executor, protected state |
| BRW-C | Supported fields/files/multistep + canonical answers | Known answers filled, unknown asked once, no unapproved upload |
| BRW-D | Pause/correction/reconnect/recovery and checklist | Same record/revisions; uncertain actions not blindly replayed |
| BRW-E | Final-action/adversarial tests + consented live inspect-only smoke | Manual handoff with explicit tested scope |

## Acceptance

- [ ] **BRW-01:** Supported form variants/control types are enumerated; the visible local flow fills approved known data and exact attachment without a universal-platform claim.
- [ ] **BRW-02:** Unknown, context-sensitive, voluntary self-ID, stale or conflicting answers pause; confirmed new answers persist in S3 and edits update the correct scope.
- [ ] **BRW-03:** File/origin/session/actor allowlists deny arbitrary local upload, cross-candidate profile use, unauthorized redirect, exposed debugging and page-injected tool expansion.
- [ ] **BRW-04:** Fresh frame/control observations and bounded steps/time/retries handle stale DOM, failed upload, popup/iframe/multistep and unsupported controls with explicit review state.
- [ ] **BRW-05:** Pause/restart/lease-loss/reconnect preserves acknowledged changes and approved artifact revision; uncertain remote effects are re-observed or escalated, never blindly replayed.
- [ ] **BRW-06:** Final submission via button, Enter/default action, confirmation step, form event or direct network tool is unavailable/denied in supported adapters; unknown effect causes manual handling.
- [ ] **BRW-07:** Login/MFA/challenges are user-controlled; no stealth/CAPTCHA/evasion/social-send tooling, raw secrets in traces or hidden platform actions exist.
- [ ] **BRW-08:** UI/agent final checklist shows filled/missing/failed fields, attachment and uncertainty; only manual confirmation/accepted evidence changes submitted outcome, with score/tier/packet snapshot.

## Integration Test

**Proposed:** `node --test maxim/app/tests/integration/browser-assistance.test.mjs` plus `maxim/app/tests/e2e/browser-assistance.spec.mjs`.

Run actual executor adapters against isolated local fixture servers, not a mocked pretend fill. Include all field types claimed supported, malicious labels/page instructions, autosave disclosure, cross-frame file upload, stale references, keyboard/default submit and worker/daemon restart. Assert forbidden network/final effects at the fixture server.

At least one consented real posting inspection/review smoke per claimed form variant is separately required. Stop before final action; user performs any actual submission manually. A browser-launch screenshot alone proves neither form support nor policy safety.

## Files Changed

~~~text
maxim/app/src/server/browser/{sessions,policy,observations,actions,review}/
maxim/app/src/server/browser/adapters/            reviewed executor + supported form variants
maxim/app/src/worker/browser.ts                   interactive host execution only
maxim/app/src/app/                               session/progress/unknown/review controls
maxim/db/postgres/                               sessions, progress, review/evidence references
maxim/app/tests/{integration,e2e,fixtures}/       local forms + denied-effect server assertions
docs/maxim/testing/website-safety-test-plan.md    expanded behavioral boundary
docs/maxim/                                      actual supported-site/session/privacy guide
~~~
No restoration of the old runner's algorithm under a different filename. S5 retirement and native Playwright retention remain explicit.

## Dependencies And Handoff

Requires S5, including canonical applications, approved packet, S3 answer/context contracts and S2 work leases. Produces **browser-review** and **manual-submission-evidence**.

Live login/site access requires the user's authorized session. No platform bypass or credential sharing in chat. Future company/custom/Workday/LinkedIn/Indeed rollout adds a new tested capability row, not a blanket toggle.

## What Shipped

Pinned agent-browser, dedicated visible sessions, approved facts/answers/PDF, pause/resume, explicit manual handoff and isolated tests are implemented. Final combined regression and permitted live form-variant certification remain outstanding.

See [measured MVP verification and remaining gates](../reviews/mvp-completion-verification.md). No unrun acceptance checkbox is promoted.

## Deferred To Later Stages

Remote/cloud browser, automatic account creation, broad ATS rollout and wearables. Autonomous final submission and LinkedIn messaging are not part of this roadmap.

## Comments And Miscellaneous

> **Comments**
>
> Add corrections, questions, or additional requirements here. Changes that affect another stage must update its handoff and the registry.
