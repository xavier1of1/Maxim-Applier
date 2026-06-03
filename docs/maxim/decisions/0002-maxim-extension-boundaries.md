# ADR 0002 - Maxim Extension Boundaries

## Decision

Maxim-owned implementation belongs in isolated extension areas:

- `maxim/config/`
- `maxim/db/`
- `maxim/lib/`
- `maxim/scripts/`
- `maxim/tests/`
- `data/maxim/`
- `dashboard/src/app/maxim/`
- `dashboard/src/components/maxim-command-center.tsx`
- `dashboard/src/lib/maxim-service.ts`

The existing Python backend and Next dashboard remain native repository behavior. Maxim dashboard additions consume dashboard DTOs or service functions instead of parsing Career-Ops artifacts or querying SQLite directly.

## Guardrails

- Do not rewrite the existing scoring, application, evidence, notification, analytics, inbox, or dashboard modules unless a specific extension seam requires it.
- Do not overwrite raw Career-Ops files or historical imports.
- Additive scripts may read and index Career-Ops-like artifacts; they must treat parse failures as warnings.
- Important Maxim actions append events under `data/maxim/events/`.
