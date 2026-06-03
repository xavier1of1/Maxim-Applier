# Maxim Apply Release Candidate Checklist

Last updated: 2026-06-03

Use this before calling the fork operationally ready.

## Code And Safety Gates

- [ ] `npm run doctor`
- [ ] `npm run verify`
- [ ] `npm run maxim:doctor`
- [ ] `npm run maxim:test`
- [ ] `npm run maxim:safety`
- [ ] `npm run maxim:alignment`
- [ ] `npm run maxim:operational`
- [ ] `npm run maxim:e2e`
- [ ] `npm run maxim:dashboard-state`
- [ ] `cd dashboard; gofmt -l internal\maxim\model.go internal\maxim\service\service.go`
- [ ] `cd dashboard; go test ./...`

## Operational Data Gates

- [ ] Approved evidence source exists locally.
- [ ] Real Career-Ops reports exist under `reports/`.
- [ ] Real Career-Ops PDFs exist under `output/`.
- [ ] `data/applications.md` has real tracker rows.
- [ ] Historical tracker import has been run on Xavier's real tracker.
- [ ] Contacts list exists locally with connection strength 1-3 where known.
- [ ] `npm run maxim:import-contacts -- data\maxim\contacts.csv --no-store`
- [ ] `npm run maxim:import-contacts -- data\maxim\contacts.csv`
- [ ] Target-company list exists locally.
- [ ] `npm run maxim:import-target-companies -- data\maxim\target_companies.csv --no-store`
- [ ] `npm run maxim:import-target-companies -- data\maxim\target_companies.csv`
- [ ] Application outcomes have enough NoVA/DC-compatible records for meaningful analytics.
- [ ] Discord dry-run reviewed.
- [ ] Optional live Discord notification tested with `MAXIM_DISCORD_WEBHOOK_URL`.

## Dashboard Gates

- [ ] Native Career-Ops dashboard opens.
- [ ] Pressing `m` opens Maxim Apply mode.
- [ ] Today view renders empty and populated states.
- [ ] High Conviction view renders T3 and priority T2 rows.
- [ ] Networking view renders ready-to-send drafts or a clear empty state.
- [ ] Recruiter Inbox view renders Needs Response items or a clear empty state.
- [ ] Applications view renders packet readiness and duplicate-risk labels.
- [ ] Analytics view renders KPI and small-sample warning.
- [ ] Pressing `m`, `q`, or `esc` exits Maxim mode back to Career-Ops.

## Non-Scope Confirmation

- [ ] No LinkedIn send automation exists.
- [ ] No full application auto-submit exists.
- [ ] No CAPTCHA bypass or anti-bot evasion exists.
- [ ] No active-clearance claim exists.
- [ ] No secrets, private contacts, recruiter notes, or sensitive tracker rows are staged.

## Phase 11 Decision Prep

Do not start future executor implementation from this checklist. Phase 11 assessment is ready only after real usage data shows the Career-Ops assisted workflow and manual submission remain the bottleneck after dashboard, networking, recruiter, notification, and analytics workflows are operational.
