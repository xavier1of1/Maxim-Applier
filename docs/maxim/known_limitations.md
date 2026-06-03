# Maxim Apply Known Limitations

Last updated: 2026-06-03

- Career-Ops reports/PDFs are not present beyond placeholders in this fresh fork, so `maxim:sync` currently has no real evaluation artifacts to ingest.
- `data/applications.md` has no real rows yet, so dashboard queues and analytics denominators are empty.
- The local `cv.md` is evidence-gated and does not contain full approved resume evidence yet.
- No approved `article-digest.md` or private evidence file has been provided yet.
- Live Discord notifications require `MAXIM_DISCORD_WEBHOOK_URL`; only dry-run validation has been completed.
- Dashboard write actions are still CLI-backed; the dashboard views are read-only for Maxim state.
- `go test ./...` passes for the dashboard, but the interactive Bubble Tea TUI still needs a manual smoke test in a real terminal.
- Analytics currently run on empty or fixture/small local data until real applications/outcomes are imported or synced.
- Historical import supports standard CSV/XLSX worksheet data; unusual workbook formulas, merged cells, or multiple-sheet semantics may require a follow-up importer refinement.
- Networking workflows require user-provided contacts and Xavier manually sends all outreach.
- No autonomous executor is implemented or approved.
