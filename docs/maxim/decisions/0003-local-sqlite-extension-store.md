# ADR 0003 - Local SQLite Extension Store

## Decision

Maxim uses a local-first SQLite extension store at `data/maxim/maxim.db`, with schema in `maxim/db/schema.sql`. SQLite is hidden behind `maxim/lib/sqlite-store.mjs`.

The JavaScript store uses Python's standard-library `sqlite3` through a small subprocess bridge. This avoids adding a production npm dependency while still producing a real SQLite database. If the project later adopts a root Node dependency policy, the bridge can be replaced by a native SQLite package without changing the store interface.

## Event Log

Meaningful actions are also written to append-only JSONL files in `data/maxim/events/`. The event log is the audit/replay source; the SQLite database is the query surface.

## Consequences

- Scripts can initialize and query the store without network access or secrets.
- The store remains local and user-controlled.
- The dashboard must not call this store directly; it should use dashboard services or backend APIs.
