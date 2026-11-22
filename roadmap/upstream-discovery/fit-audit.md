# Experience-Level And Fit Audit

Date: 2026-11-21. This is a measured investigation, not a claim that every
matching job is competitive or that the local market lacks good jobs.

## What Was Wrong

At the investigation checkpoint there were 358 active jobs. 176 had explicit
senior/staff/principal/management titles; 12 of the 27 newly retained market
records had those titles. These are title-based diagnostics, not inferred years.
Existing approved experience-level preferences were present but not used by the
new discovery profile or automatic queue.

Built In's default queried the national engineering category. Its first bounded
pages were not an appropriate substitute for DC/early-career retrieval. Screening
cannot recover appropriate roles that never appeared in the fetched pages.

Role and experience-level preferences shared a local-only source with unrelated
personal fields. The evaluator correctly did not disclose that source. However,
the scoring prompt then lacked the candidate's actual targets. One report used
neutral North Star alignment because preferences were unknown. Enabling that
entire source would disclose unrelated personal details and was not a valid fix.

## Why The Senior React Role Ranked Highly

The saved Anduril Senior Front End Software Engineer, React report scored 3.6/5,
not 4.0+. Its arithmetic was internally consistent:

| Retained dimension | Score | Weight | Contribution |
| --- | --- | --- | --- |
| CV match | 3.5 | 40% | 1.40 |
| North Star alignment, unknown/neutral | 3.0 | 25% | 0.75 |
| Compensation | 5.0 | 20% | 1.00 |
| Cultural signals | 3.0 | 15% | 0.45 |
| Total | 3.6 | 100% | 3.60 |

The report described senior front-end ownership as unproven. A high posted salary
improved the weighted total without establishing senior-level scope. It was a
relatively high score in a poorly targeted sample, not a strong application.
T1 means Strategic Override Only. Career-Ops' global score includes more than
hiring competitiveness; no replacement score or arbitrary inflation is introduced.

Kaizen Labs' Software Engineer report was a more appropriate level match: the JD
described approximately two to four years and the report gave CV match 4.1/5 but
global fit 3.8/5. Missing context and unanswered requirements must be investigated,
not turned into invented experience or a promised offer.

## Corrections

1. The owner explicitly approved model disclosure of target roles and experience
   levels only. Existing owner fact commands create separate professional
   declarations for those fields. The original shared source stays local-only;
   contact, location, compensation, authorization and clearance disclosure is not
   broadened. Candidate revision changes invalidate prior current evaluations.
2. The native projection expresses disclosed roles/levels as native target-role
   and archetype context. It does not copy the upstream author's senior/staff
   example profile or change the scoring rubric.
3. A reviewed search profile includes target experience levels. A pure Rust rule
   rejects explicit mismatched senior/staff/management titles before paid scoring
   and detail exploration. Unknown titles stay unknown; no years are fabricated.
4. Automatic shortlist mode holds explicit level mismatches. All scanned mode
   still covers the active complete backlog, but compatible/unknown-level roles
   receive attention before explicit mismatches. This is queue priority, not a
   second fit score or silent scope change.
5. Built In now uses its Washington DC path plus bounded junior/Engineer II
   queries for early/mid targets. The broad engineering category remains an
   exploration lane. No unsupported experience API or extra paid service is used.
6. The owner approved two million tokens for validation while retaining the
   $5/day and 100-evaluation caps. No other allowance was silently raised.
7. A bounded local foreground now accompanies the rotating global scoring window;
   a rotation cannot exclude local complete candidates from consideration. Rust
   prioritizes location/experience compatibility without removing global backlog
   from All scanned mode. Detail reads likewise prioritize verified local candidates.

Existing senior jobs are not deleted and historical scores are not rewritten.

## Verification

Rust tests cover Sr./Senior, Staff, management-before-Associate precedence,
Engineer I versus II, unknown titles and compatible-level-first all-scanned
ordering. TypeScript covers compilation, DC queries and professional-only
projection. Mounted discovery proves matching duties do not rescue a wrong-level
job; onboarding/budget regressions and desktop/mobile controls are also tested.

The initial full run passed 145 backend integration tests and 43 Chromium
journeys. Focused correction tests and live re-evaluation are recorded in
[verification](verification.md).

Measured re-evaluation: Kaizen Labs' Software Engineer moved from 3.8/T1 to
4.0/T2 after the approved target-context correction. No stored number was edited
and no scoring threshold changed. This is a concrete qualified result, not a
guarantee of an interview. Other incomplete or incompatible jobs remain held.

Latest local ranking at 2026-11-22T00:07:56Z:

| Role | Current Career-Ops score | Tier |
| --- | --- | --- |
| Thea - Software Engineer | 4.1/5 | T2 |
| Kaizen Labs - Software Engineer | 4.0/5 | T2 |
| Anduril - 2027 Early Career Systems Engineer | 4.0/5 | T2 |

There were 19 current evaluations on candidate revision 63, zero pending at that
checkpoint, and $2.42 settled in the automatic ledger against the $5/day cap.
The old senior React result is not the top current local recommendation. Review
each full report, actual requirements and liveness before preparing an application.

## Remaining Uncertainty

Generic titles can conceal senior requirements. Title-level targeting is a cheap
retrieval guard, not certification of years, required skills, degree, clearance
or vacancy status. Full descriptions and approved evidence still reach Career-Ops
evaluation and local policy review. Board entry-level labels are not independently
verified employer requirements.

The absence of 4.0+ was real for the earlier saved reports, but not evidence that
the candidate has no 4.0+ opportunities in the market. Appropriate retrieval and
current, consented context must be tested before drawing that conclusion.

Sources: pinned provider code, saved hash-verified reports, and public
[DC engineering](https://builtin.com/jobs/washington-dc/dev-engineering) and
[DC entry-level engineering](https://builtin.com/jobs/washington-dc/dev-engineering/entry-level)
pages. Regional search availability is not certification of every result.
