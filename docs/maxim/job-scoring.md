# Scanning, Fit Scores And Ranking

Updated: 2026-11-20. Open [Jobs](http://127.0.0.1:3010/maxim?view=jobs).

## Scanning Is Discovery, Not Fit Evaluation

Discovery reads configured company boards through Greenhouse, Lever and Ashby
public feeds, using retained Career-Ops provider mappings. The UI matches role
terms against titles by default; titles plus descriptions is an explicit option.
Source/run history records partial coverage and errors. This is not automatic
search of every company, LinkedIn, Indeed or Workday.

Normalization preserves opening identity, source, URL, location, description and
available dates/pay. Deterministic policy flags cover location, salary, clearance
and freshness. Missing details require review. A NoVA/DC match or Policy eligible
badge is not an experience score. Scanning makes no fit-evaluation model request;
saving a job does not score it.

## How Your Experience Is Scored

Select a job and choose **Evaluate with Career-Ops**, use the Applications action,
or request evaluation in a role-scoped agent conversation. This needs a full current
description, active reviewed Candidate authority, model-permitted professional
facts and a configured model. It is an explicit, potentially billable request.
The scanner never automatically evaluates every matching posting.

The evaluator combines retained `modes/_shared.md` and `modes/oferta.md` with your
current approved, model-disclosable facts and the exact job description. Career-Ops
asks the model to compare requirements to evidenced skills/experience, target-role
alignment, compensation, cultural signals and red flags. It returns an explanatory
report and global 1.0-5.0 score. The rubric describes weighted judgment; this adapter
does not implement a second fixed numeric formula. Fit is a model assessment,
not an interview probability.

Rust validates report identity, required sections and score consistency. Invalid
or incomplete output has no usable score. The model has no browser/research tools
in this evaluation request: missing market data or current posting liveness must
remain unknown. Legitimacy and policy are separate from numerical fit.

| Career-Ops Score | Maxim Tier | Meaning |
| --- | --- | --- |
| Below 3.5 | T0 | No Apply |
| 3.5 to below 4.0 | T1 | Strategic override only |
| 4.0 to below 4.5 | T2 | Qualified apply, subject to policy/packet approval |
| 4.5 to 5.0 | T3 | High conviction, subject to policy/packet approval |

## What The Dashboard Shows

Jobs defaults to **Score: highest first**, with lowest-first, recent and company
orders available. The order survives navigation and reload in the URL. Only
current valid scores rank numerically; unknown and stale results are last in both
directions. Company alternation does not override score sorting. The role list,
selected details and Discovery display the same stored score/tier. Job details
link to the full report and expose explicit evaluation/re-evaluation.

**Not evaluated**, **Evaluation queued**, **Evaluating**, **Evaluation failed**,
**Evaluation cancelled**, **Evaluation needs review** and **Re-evaluation needed**
are distinct, never a fabricated zero or low fit. A summary counts visible roles
with current scores. The latest evaluation is used: an older high score does not
silently replace a failed or pending new evaluation.

Changes to candidate/posting revisions, retained engine, reviewed posting policy
or supporting evidence invalidate current ranking. Previous reports remain
inspectable but outdated scores are not current matches. Submission snapshots
remain historical; scoring does not approve or submit an application.

Database sorting precedes the bounded 500-role response. The exact selected role
is additionally loaded if outside that window. Location, text, archive and
selected-run filters still apply in the UI. A partial-view notice means the page
is bounded, not that earlier records were deleted. Discovery never borrows results
from another search run. No personal jobs were automatically evaluated or charged
for deploying this UI. Continue with [application lifecycle](application-lifecycle.md).
