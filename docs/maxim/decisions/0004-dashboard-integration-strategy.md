# ADR 0004 - Dashboard Integration Strategy

## Decision

This repository is now the actual Career-Ops fork and includes the native Go dashboard. The Maxim Apply mode is implemented through a minimal dashboard hook: pressing `m` in the native pipeline opens an isolated Maxim command-center screen under `dashboard/internal/maxim`.

The Maxim screen reads Career-Ops tracker data passed from the dashboard root and maps it into dashboard DTOs. It does not parse raw reports directly and does not query SQLite directly.

## Consequences

- Existing Career-Ops dashboard behavior remains intact.
- Maxim mode is an additive dashboard surface, not a separate CRM application.
- Empty states are safe because the Maxim screen can render from an empty tracker.
