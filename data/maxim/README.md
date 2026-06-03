# Maxim Local Data

This directory is Maxim-owned local state.

- `maxim.db` is the local SQLite extension store and is ignored by git.
- `events/` contains append-only JSONL audit events.
- `imports/raw/` preserves raw historical inputs.
- `imports/normalized/` may hold normalized exports or import reports.
- `exports/` and `notifications/` are local output areas.

Do not commit secrets or personal raw data from this directory.
