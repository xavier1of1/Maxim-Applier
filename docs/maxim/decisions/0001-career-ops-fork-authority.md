# ADR 0001 - Career-Ops Fork Authority

## Decision

Maxim Apply is implemented as a limited, purpose-driven Career-Ops fork extension. In this repository, the requested `docs/V2 Redesign/*v2_0.md` and `*v1_0.md` files are not present, so the implementation uses the newer available authority files:

1. `docs/V2 Redesign/maxim_apply_career_ops_implementation_roadmap_v1_1.md`
2. `docs/V2 Redesign/maxim_apply_career_ops_redesign_v2_1.md`

This assumption should be revisited only if the missing v2.0/v1.0 files are restored and explicitly supersede v2.1/v1.1.

## Consequences

- Career-Ops scoring, PDF generation, scanning, apply assistant behavior, trackers, and native dashboard behavior remain preserved.
- Maxim-specific logic lives in `maxim/`, `data/maxim/`, `docs/maxim/`, and small dashboard integration surfaces.
- Career-Ops score remains the primary fit input. Maxim can add tiers, flags, overlays, and next actions but cannot replace the fit score.
- Auto-submit and LinkedIn message sending are out of scope for this version.
