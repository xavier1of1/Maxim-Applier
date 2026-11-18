# Website and Platform Safety Test Plan

## Scope

The Maxim extension safety suite prevents prohibited platform behavior from creeping into v1.

## Required Checks

- No LinkedIn message sending module, function, or script.
- No application auto-submit code path.
- No CAPTCHA bypass logic.
- No anti-bot evasion dependency or pattern.
- No unbounded retry loops or high-frequency polling patterns in Maxim-owned website-facing code.
- Website-facing scripts must prefer dry runs, bounded retries, human-scale pacing, and explicit stop conditions.

## Current Implementation

`maxim/scripts/website-safety-check.mjs` scans repository source text for prohibited platform automation, evasion, unbounded retry, and polling patterns. It reports clear failures and is intentionally framed as a safety, reliability, and reputation-protection check, not as evasion tooling.

Run with:

```powershell
npm run maxim:safety
```

## Integrated Workspace Coverage

The primary application executor is pinned agent-browser 0.43.0, not Playwright.
Real native-Chrome fixture tests verify stale controls/other-opening denial,
hidden resume selection/exact PDF bytes, network containment before manual review
and release only on explicit handoff. API tests bind current candidate, approved
packet and exact answer-use revisions; agent tools cannot approve or submit.
Final changed integration/UI reruns await Docker recovery and are not counted
as passing. No live employer submission is a safety test.

Gmail and Discord response reads have byte/chunk/deadline ceilings; delivery has
persistent accepted/uncertain states and bounded retries. Local status refreshes
are sequential, visible-only and ninety-second bounded. The existing scanner's
rules were not weakened or exempted to accommodate the new code. Static scanning
is a heuristic, not a proof of all browser or dependency behavior. Consult the
[measured record](../../../roadmap/reviews/mvp-completion-verification.md) and
[browser support matrix](../browser-assistance.md).
