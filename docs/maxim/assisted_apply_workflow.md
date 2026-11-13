# Maxim Assisted Apply Workflow

Last updated: 2026-06-05

## Decision

Maxim Apply v1 does not include a full autonomous application submitter. The approved workflow is an assisted apply queue:

1. Career-Ops evaluates the role and generates the report/PDF packet.
2. Maxim syncs the Career-Ops evaluation.
3. Maxim queues eligible T2/T3 roles as application records.
4. Xavier opens the job page and uses `/career-ops apply` for answer drafting and packet guidance.
5. Xavier reviews, edits, and submits manually.
6. Maxim records `assisted_apply_started` and `submitted_manually` events.

This follows the v2.1 boundary: Career-Ops remains the apply assistant, Maxim adds orchestration and state, and final submission remains manual.

## Commands

Queue eligible synced evaluations:

```powershell
npm run maxim:apply-workflow
```

Build guided apply plans for queued applications:

```powershell
npm run maxim:auto-apply -- prepare
npm run maxim:auto-apply -- prepare --ready-only --limit 5
npm run maxim:auto-apply -- plan
npm run maxim:auto-apply -- plan --ready-only --limit 5
npm run maxim:auto-apply -- plan-one <application-id>
```

`prepare` runs Career-Ops sync, promotes eligible T2/T3 evaluations into application records, then produces plans. These plans collect the job URL, Career-Ops packet links, approved Xavier profile answers, review blockers, stop conditions, and the exact commands for marking progress.

Inspect or fill known-safe fields in a browser:

```powershell
npm run maxim:auto-apply-browser -- inspect <application-id>
npm run maxim:auto-apply-browser -- assist <application-id>
npm run maxim:auto-apply-browser -- assist <application-id> --record-started
npm run maxim:auto-apply-browser -- assist <application-id> --record-started --write-report
npm run maxim:auto-apply-browser -- assist <application-id> --record-started --write-report --max-steps 4
```

`inspect` only reads the form and maps fields. `assist` follows safe Apply launchers, reads embedded form iframes, maps conservative nearby visual labels for unlabeled ATS fields, fills approved known fields, matches clear dropdown aliases, checks explicit matching radio/checkbox choices, validates native typed inputs before fill, and attaches the packet PDF through visible or styled hidden upload inputs when present. It can click only safe non-final `Next`/`Continue` controls up to `--max-steps`; it stops before submit/finish/apply controls, platform challenges, unavailable postings, and any required field that needs Xavier review. Individual field failures are included in the run report instead of aborting the entire run. CLI output and saved reports include a review checklist with required fields, optional fields, failed fields, final controls, stop reasons, and next manual actions.
`--record-started` updates the local application status to `assisted_apply_started` only after at least one known-safe field was actually filled on a usable page, then appends an audit event.
`--write-report` writes a redacted browser run report under `data/maxim/auto-apply-runs/` for later review.

If no tailored Career-Ops PDF is linked yet, the planner may use a local source resume PDF from `data/maxim/imports/raw/resume_sources/` as an attachment fallback and will warn that it is not a tailored packet.

If a report points to an aggregator URL instead of an official ATS form, add a local ignored override at `data/maxim/job_url_overrides.json`. Use `data/maxim/templates/job_url_overrides.example.json` as the shape.

Preview queueing without writing:

```powershell
npm run maxim:apply-workflow -- --dry-run
```

Start assisted apply for a queued application:

```powershell
npm run maxim:application -- started <application-id>
```

Use the Career-Ops assistant in Claude/Codex:

```text
/career-ops apply
```

After Xavier submits manually:

```powershell
npm run maxim:application -- submitted <application-id>
```

## Eligibility

Default queue:

- `T2` Qualified Apply
- `T3` High Conviction

Held or skipped:

- `T0` No Apply
- `T1` Strategic Override Only, unless explicitly included with `--include-t1`
- high duplicate-risk applications
- missing report/PDF packet artifacts

## Safety Boundaries

- No final application submission automation.
- No LinkedIn message sending.
- No CAPTCHA bypass.
- No anti-bot evasion.
- No fabricated answers or candidate claims.
- All meaningful state transitions append audit events.
