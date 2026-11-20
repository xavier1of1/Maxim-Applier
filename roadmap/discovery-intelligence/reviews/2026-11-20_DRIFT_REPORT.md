# EGM Drift And Fresh-Context Audit

Scope: discovery-intelligence design directory against the existing queue,
authorization, scanning, evaluation and storage code. Source-only context; no
private data. EGM drift-report skill plus two independent fresh-context audits.
This is not a formally gate-approved or converged EGM review loop.

## README.md
- Existing scanner has no fair intake cap; rotate source priority each cycle and
  use a per-source fair share, then diversify evaluation selection. Record partial
  coverage rather than claiming the feed was exhausted.
- Browser-session command authorization cannot be reused for timers. Extract
  transactional queue functions; scheduled grants are the owner-saved policy
  revision, workspace, candidate revision and model/API/pricing identity.
- Serialize admission on a workspace advisory lock. Reserve before queueing and
  allow at most one automatic dispatch in flight. Set automatic work max_attempts
  to one, persist sending before I/O, and keep crash-left sends uncertain. Never
  retry an ambiguous model POST automatically.
- Pause before dispatch prevents sending. Pause after a committed dispatch fence
  can still leave an in-flight charged request; suppress late publication and
  retain its reservation. UI/docs must state this non-atomic external boundary.
- Protect application evidence without consuming active-lead slots forever:
  submitted/terminal historical applications are outside the active lead cap.
- Cleanup hashes candidate identities/revisions and policy revision; recheck all
  protections under the same lock used by save/intent/scan mutations at apply.
- Compact every persisted duplicate: unprotected descriptions, evaluation input
  snapshots/reports, expired provider pages and observation raw fields. Keep
  protected/submitted copies. Archived compact stubs cannot be rehydrated by an
  ordinary rescan; only an explicit capacity-checked restore can do that.
- Define Home metrics by actual submission dates in policy timezone, with Monday
  week boundaries. Sankey conserves a unique submitted cohort; missing response
  or round evidence is not an invented intermediate transition. Current fit is
  not proof the vacancy is still open; show source recency/liveness separately.
- Every hold has a visible reason and action: configure/approve evidence, fetch
  full description, admit unknown dates explicitly, fix source cooldown or budget.

## Stage Plans
- Expand handoffs with exact grant, accounting, retention and cohort contracts
  above. Acceptance must exercise contention, crash-after-send, protected records,
  archive rescan, date/industry unknowns and actual UI review/enablement.

## Reviewer Receipts
- Design critic: completed, six major findings. Covered intake fairness, lead
  membership, duplicate storage, Home truth, hold recovery and alternatives.
- Implementation readiness: completed, six major findings. Covered background
  authorization, concurrent spending, replay, dispatch/revoke, cleanup races and
  rescan rehydration. No findings were represented as zero or silently discarded.

## Alternatives Recorded
Periodic bounded worker ticks are chosen over 24/7 model agents and over manual
discovery only: they reuse leases, need no new service, and only run while local
stack is available. Fair per-source rotating quotas are chosen over provider-order
prefixes; unmatched coverage remains partial. Separate compact archive plus stable
job stubs is chosen over destructive row deletion or retaining full descriptions
forever: identity/history survive while bulky data is bounded. Prices are owner
reviewed rather than scraped; missing/stale model pricing holds automatic spend.
