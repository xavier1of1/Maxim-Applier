CREATE VIEW discord_s7_ready_tasks AS
 SELECT t.workspace_id,t.id AS task_id,t.revision,'needs_response'::text AS kind,
 'pending'::text AS status,t.created_at AS due_at
 FROM gmail_response_tasks t
 JOIN gmail_links l ON l.workspace_id=t.workspace_id AND l.id=t.link_id
 JOIN gmail_observations o ON o.workspace_id=t.workspace_id AND o.id=t.observation_id
 JOIN gmail_accounts a ON a.workspace_id=t.workspace_id AND a.id=o.account_id
 WHERE t.status='open' AND l.withdrawn_at IS NULL AND NOT o.withdrawn
 AND o.expires_at>now() AND a.enabled AND a.status='connected' AND o.thread_id=ANY(a.thread_ids);

CREATE VIEW discord_s9_ready_tasks AS
 SELECT t.workspace_id,t.id AS task_id,t.revision,'networking_review'::text AS kind,
 'pending'::text AS status,t.updated_at AS due_at
 FROM networking_targets t
 JOIN jobs j ON j.workspace_id=t.workspace_id AND j.id=t.job_id
 JOIN networking_contacts c ON c.workspace_id=t.workspace_id AND c.id=t.contact_id
 JOIN candidates p ON p.workspace_id=t.workspace_id
 WHERE t.status IN ('ready_to_send','follow_up_due') AND NOT j.archived AND p.ownership='canonical'
 AND t.research->>'approved'='true' AND t.draft IS NOT NULL
 AND t.draft->>'jobRevision'=j.revision::text
 AND t.draft->>'contactRevision'=c.revision::text
 AND t.draft->>'researchHash'=t.research->>'hash'
 AND jsonb_typeof(t.draft->'facts')='array'
 AND NOT EXISTS(SELECT 1 FROM fact_dependencies d WHERE d.workspace_id=t.workspace_id AND d.entity_id=t.id AND d.status='invalidated')
 AND NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.draft->'facts')='array' THEN t.draft->'facts' ELSE '[]'::jsonb END) r
  LEFT JOIN candidate_facts f ON f.workspace_id=t.workspace_id AND f.id::text=r->>'id'
  LEFT JOIN candidate_sources s ON s.workspace_id=f.workspace_id AND s.id=f.source_id
  WHERE f.id IS NULL OR f.status<>'current' OR r->>'revision' IS NULL OR f.revision::text<>r->>'revision'
  OR f.sensitivity<>'standard' OR s.deleted_at IS NOT NULL OR s.classification='restricted' OR s.revision<>f.source_revision
 )
 UNION ALL
 SELECT t.workspace_id,t.id AS task_id,t.revision,'recruiter_reminder'::text AS kind,
 'pending'::text AS status,t.updated_at AS due_at
 FROM networking_recruiter_tasks t WHERE t.needs_response
 AND (t.resolved_through IS NULL OR t.last_evidence_at>t.resolved_through);
