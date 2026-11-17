# Assisted Application Workflow

The current implementation is described in
[Evaluation, packets and application tracking](application-lifecycle.md).

S5 prepares exact reviewed report/PDF packets and tracks actual manual actions.
It does not fill forms or submit applications. Use Applications in the local
workspace, or `npm run maxim:applications -- help`.

The rejected `maxim:auto-apply` / `maxim:auto-apply-browser` registrations are
removed. Their old script paths fail explicitly. Private historical run reports
are preserved. Browser assistance belongs to [S6](../../roadmap/stages/stage-06-browser-assistance.md);
its retained safety requirements are in `maxim/tests/fixtures/browser-safety-handoff.json`.
