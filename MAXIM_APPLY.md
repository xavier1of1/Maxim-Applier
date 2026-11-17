# Maxim Apply

Maxim Apply is Xavier Kubancik's controlled Career-Ops fork.

## November 2026 Planning

The [detailed stage index](roadmap/stages/README.md) contains twelve implementation plans with 92 acceptance cases. Read the [refinement and validation record](roadmap/reviews/roadmap-refinement.md) for actual test results and unresolved runtime defects; planning delivery does not mark these stages implemented.

Start with the [roadmap index](roadmap/README.md), [target manifesto](roadmap/MANIFESTO.md), and [high-level stages](roadmap/high-level-roadmap.md). They distinguish current behavior from accepted target changes: an early single dashboard/agent workspace, reviewed onboarding, and PostgreSQL/private artifacts/Compose with explicit migration gates. Career-Ops scoring, PDF/report generation and useful discovery remain the engine.

The [component assessment](roadmap/external-components-assessment.md) evaluates proposed reuse, including Dossier's AGPL licensing gate. The [setup checklist](roadmap/operational-setup.md) tracks accounts and private inputs; the [development workflow](roadmap/development-workflow.md) records the installed EGM plugin and required human review gates. These plans are not a claim that the new stack or browser replacement is implemented.

## Existing Fork Capabilities

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
- account-free LinkedIn/person discovery planning,
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
