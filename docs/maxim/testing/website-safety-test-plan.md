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
