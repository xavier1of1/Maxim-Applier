# Maxim Apply Known Limitations

Last updated: 2026-06-03

- One real Career-Ops evaluation/PDF/tracker row exists for BLEN, so basic operational sync is proven.
- `data/maxim/application_outcomes.csv` has no real outcome rows yet, so interview-rate analytics remain directional only.
- The local `cv.md` is evidence-gated and does not contain full approved resume evidence yet.
- `article-digest.md` exists, but evidence still needs user approval before generated materials should rely on detailed claims.
- Live Discord notifications require `MAXIM_DISCORD_WEBHOOK_URL`; live validation has completed, and duplicate suppression is active.
- Dashboard write actions are still CLI-backed; the dashboard views are read-only for Maxim state.
- `go test ./...` passes for the dashboard, but the interactive Bubble Tea TUI still needs a manual smoke test in a real terminal.
- Analytics currently run on fixture/small local data until real application outcomes are imported or synced.
- Historical import supports standard CSV/XLSX worksheet data; unusual workbook formulas, merged cells, or multiple-sheet semantics may require a follow-up importer refinement.
- Networking workflows have imported real local contacts, but Xavier still manually sends all outreach.
- No autonomous executor is implemented or approved.
