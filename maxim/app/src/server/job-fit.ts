// One latest evaluation per opening. Never promote old or revoked evidence to current fit.
export const jobFitJoin=`LEFT JOIN LATERAL (
 SELECT e.id,e.revision,e.error_code,e.score::float8 AS score,e.tier,e.report_artifact_id,e.completed_at,e.candidate_revision,e.policy,
  CASE WHEN e.status IN ('queued','running') AND work.status IN ('failed','cancelled') THEN work.status ELSE e.status END AS status,
  e.status='completed' AND e.score IS NOT NULL AND c.ownership='canonical'
   AND e.job_revision=j.revision AND e.candidate_revision=c.revision
   AND e.input_snapshot->'engine'->>'hash'=$2
   AND COALESCE(e.input_snapshot->>'policyReviewRevision','0')=COALESCE(review.revision::text,'0')
   AND NOT EXISTS(SELECT 1 FROM fact_dependencies d WHERE d.workspace_id=e.workspace_id AND d.entity_id=e.id AND d.status='invalidated') AS current
 FROM evaluations e JOIN candidates c ON c.workspace_id=e.workspace_id
 LEFT JOIN work_items work ON work.workspace_id=e.workspace_id AND work.id=e.work_id
 LEFT JOIN job_policy_reviews review ON review.workspace_id=j.workspace_id AND review.job_id=j.id AND review.job_revision=j.revision
 WHERE e.workspace_id=j.workspace_id AND e.job_id=j.id
 ORDER BY e.created_at DESC,e.id DESC LIMIT 1
) fit ON true`;
export function jobFitOrder(sort:string|null){
 if(sort==='recent')return 'j.updated_at DESC,j.id';
 if(sort==='company')return 'lower(j.company),j.updated_at DESC,j.id';
 return `CASE WHEN fit.current THEN fit.score END ${sort==='score_asc'?'ASC':'DESC'} NULLS LAST,j.updated_at DESC,j.id`;
}
