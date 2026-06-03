# Maxim Apply Known Limitations

Last updated: 2026-06-03

- Go/gofmt are not installed in the current Windows environment, so Go dashboard formatting and `go test ./...` have not been run locally.
- Career-Ops reports/PDFs are not present beyond placeholders in this fresh fork, so `maxim:sync` currently has no real evaluation artifacts to ingest.
- The local `cv.md` is evidence-gated and does not contain full approved resume evidence yet.
- Live Discord notifications require `MAXIM_DISCORD_WEBHOOK_URL`.
- Dashboard write actions are still CLI-backed; the dashboard views are read-only for Maxim state.
- Analytics currently run on empty or small local data until real applications/outcomes are imported or synced.
- Historical import supports standard CSV/XLSX worksheet data; unusual workbook formulas, merged cells, or multiple-sheet semantics may require a follow-up importer refinement.
- Networking workflows require user-provided contacts and Xavier manually sends all outreach.
- No autonomous executor is implemented or approved.
