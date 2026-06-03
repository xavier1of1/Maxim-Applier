# Maxim Apply Gap Analysis

Last updated: 2026-06-03

Authority checked:

- `docs/V2 Redesign/maxim_apply_career_ops_redesign_v2_0.md`
- `docs/V2 Redesign/maxim_apply_career_ops_implementation_roadmap_v1_0.md`
- Compatibility files point to v2.1/v1.1, which were used as current implementation authority.

## Summary

All roadmap phases that can be completed without real application outcomes or live recruiter email data are implemented and validated. Basic real Career-Ops operation is now proven with one BLEN evaluation/report/PDF/tracker row. Remaining gaps are outcome-data gaps, user-review gates, or intentionally deferred v1 non-scope items.

## Requirement Matrix

| Requirement | Status | Evidence | Gap / Blocker | Effort |
|---|---|---|---|---|
| Controlled Career-Ops fork | COMPLETE | branch/remotes, ADRs, alignment guard | None | None |
| Preserve Career-Ops engine | COMPLETE | `npm run doctor`, `npm run verify`, safety/alignment | None | None |
| Isolated Maxim extension paths | COMPLETE | `maxim/`, `data/maxim/`, `docs/maxim/`, `dashboard/internal/maxim/` | None | None |
| Local SQLite store | COMPLETE | schema, store tests, E2E | None | None |
| Append-only events | COMPLETE | event log/store tests | None | None |
| Career-Ops sync adapter | COMPLETE | fixture sync plus real BLEN report/PDF/tracker sync | More real evaluated roles needed for daily operation | User data |
| Score-to-tier router | COMPLETE | threshold tests, E2E T3 | None | None |
| Policy flags | COMPLETE | NoVA/DC, salary, clearance, freshness tests | None | None |
| Integrated dashboard mode | COMPLETE | Go render tests, `go test ./...` | Manual TUI screenshot still optional | Low |
| Dashboard write actions | PARTIAL | CLI-backed mutation flows exist | In-dashboard mutation UI not implemented | Medium |
| Historical tracker import | COMPLETE | CSV/XLSX tests, fixture import | Real tracker workbook exists locally but needs user confirmation before strategic use | User review |
| Contact import/ranking | COMPLETE | real `contacts.csv` imported, unit tests | Real normalized LinkedIn export uses weaker shape; use `contacts.csv` path | Low |
| Message draft queue | COMPLETE | draft tests/E2E | No send path by design | None |
| LinkedIn auto-send | NOT IMPLEMENTED | safety tests | Intentionally prohibited | Not applicable |
| Recruiter inbox | COMPLETE for manual tracking | create/respond/correct tests, E2E | No Gmail adapter/live mailbox ingestion | Medium; requires account/integration approval |
| Discord notifications | COMPLETE | dry-run, live send, duplicate suppression | No issue; live webhook validated | None |
| Analytics KPI | COMPLETE structurally | metrics tests, E2E, live BLEN application sync | Real interview/outcome denominator missing | User data |
| Analytics deep recommendations | PARTIAL | small-sample scaffold exists | Real usage history needed before recommendations are trustworthy | User data + medium |
| Application tracking | COMPLETE for v1 | manual status tests/E2E | Dashboard write actions not implemented | Medium |
| Auto-submit | NOT IMPLEMENTED | safety tests | Intentionally deferred Phase 11 | Requires separate approval |
| Website safety tests | COMPLETE | `npm run maxim:safety` | None | None |
| Operator docs | COMPLETE | `docs/maxim/operator_guide.md` | None | None |

## Remaining Blockers

- Additional real Career-Ops reports/PDFs/tracker rows beyond the BLEN validation row.
- Real application outcomes/interview rounds.
- User approval before drawing strategy conclusions from historical tracker/contact data.
- Optional Gmail/recruiter integration design if manual recruiter tracking is not enough.

## Phase 11

Future executor work is NOT ready. It requires real usage data proving manual submission remains the bottleneck after assisted apply, dashboard prioritization, networking, recruiter tracking, notifications, and analytics are operational.
