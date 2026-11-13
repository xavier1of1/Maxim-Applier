import test from "node:test";
import assert from "node:assert/strict";

import { parseApplicationsMd, parseCareerOpsReport } from "../../lib/careerops-parser.mjs";

test("Career-Ops parser prefers report headers over body prose", () => {
  const parsed = parseCareerOpsReport(`# Evaluation: BLEN — Senior Software Developer I - Full Stack

**Date:** 2026-06-03
**URL:** https://jobs.lever.co/blencorp/92606e36-818c-4a41-a49d-f4fca18e7134
**Archetype:** Full-Stack Software Engineer
**Score:** 3.9/5
**Legitimacy:** High Confidence
**PDF:** output/cv-xavier-kubancik-blen-2026-06-03.pdf

## D) Comp and Demand

* **Current salaries for the role:** The job description explicitly states a salary range.
* **Company's compensation reputation:** BLEN offers competitive salaries.
`);

  assert.equal(parsed.company, "BLEN");
  assert.equal(parsed.role, "Senior Software Developer I - Full Stack");
  assert.equal(parsed.score, 3.9);
  assert.equal(parsed.jobUrl, "https://jobs.lever.co/blencorp/92606e36-818c-4a41-a49d-f4fca18e7134");
});

test("tracker parser extracts score, report path, PDF readiness, and job links", () => {
  const rows = parseApplicationsMd(`# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
| 1 | 2026-06-03 | BLEN | Senior Software Developer I - Full Stack | 3.9/5 | Evaluated | ✅ | [001](reports/001-blen-2026-06-03.md) | Strategic override. |
`);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].company, "BLEN");
  assert.equal(rows[0].score, 3.9);
  assert.equal(rows[0].status, "Evaluated");
  assert.equal(rows[0].pdfReady, true);
  assert.equal(rows[0].reportPath, "reports/001-blen-2026-06-03.md");
});
