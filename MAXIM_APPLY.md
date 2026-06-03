# Maxim Apply

Maxim Apply is Xavier Kubancik's controlled Career-Ops fork.

Career-Ops remains the engine for:

- job evaluation,
- 1.0-5.0 scoring,
- tailored PDF generation,
- portal scanning,
- application-answer drafting,
- tracker artifacts,
- and the native Go dashboard.

Maxim adds isolated extensions for:

- Career-Ops score to Maxim tier mapping,
- Xavier-specific NoVA/DC policy flags,
- command-center dashboard mode,
- networking shortlist and ready-to-send drafts,
- recruiter response tracking,
- Discord accountability,
- historical analytics,
- application packet tracking,
- and safety checks.

The fork boundary is documented under `docs/maxim/decisions/`. Maxim code lives under `maxim/` and `dashboard/internal/maxim/` unless a small documented Career-Ops dashboard hook is required.

Out of scope for this version:

- LinkedIn message sending,
- full application auto-submit,
- CAPTCHA bypassing,
- anti-bot evasion,
- fabricated candidate claims,
- active-clearance claims.
