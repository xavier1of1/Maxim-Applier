-- One-time metadata backfill, not an evaluation or candidate claim.
UPDATE jobs SET role_lane=CASE
 WHEN lower(title) LIKE '%forward deployed%' OR lower(title) LIKE '%deployment strategist%' THEN 'Forward deployed'
 WHEN lower(title) LIKE '%full stack%' OR lower(title) LIKE '%full-stack%' THEN 'Full stack'
 WHEN lower(title) LIKE '%front end%' OR lower(title) LIKE '%frontend%' THEN 'Frontend'
 WHEN lower(title) LIKE '%back end%' OR lower(title) LIKE '%backend%' THEN 'Backend'
 WHEN lower(title) LIKE '%data engineer%' THEN 'Data engineering'
 WHEN lower(title) LIKE '%automation%' OR lower(title) LIKE '%test engineer%' THEN 'Automation'
 WHEN lower(title) LIKE '%systems%' OR lower(title) LIKE '%platform%' OR lower(title) LIKE '%devops%' THEN 'Systems / platform'
 WHEN lower(title) LIKE '%software%' OR lower(title) LIKE '%developer%' OR lower(title) LIKE '%engineer%' THEN 'Software engineering'
 ELSE 'Other roles' END WHERE role_lane IS NULL;
CREATE INDEX jobs_industry_lane ON jobs(workspace_id,industry,role_lane);
