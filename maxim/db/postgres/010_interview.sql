CREATE TABLE interview_sessions (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), job_id uuid NOT NULL,
 job_revision integer NOT NULL, candidate_revision integer NOT NULL, context_id uuid NOT NULL,
 mode text NOT NULL CHECK(mode IN ('project_defense','behavioral','system_design')),
 revision integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','stale','deleted')),
 snapshot jsonb NOT NULL, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id),
 FOREIGN KEY(workspace_id,context_id) REFERENCES candidate_contexts(workspace_id,id)
);
CREATE INDEX interview_role_sessions ON interview_sessions(workspace_id,job_id,created_at DESC);
CREATE TABLE interview_evidence (
 workspace_id uuid NOT NULL, session_id uuid NOT NULL, fact_id uuid NOT NULL, fact_revision integer NOT NULL,
 source_id uuid NOT NULL, source_revision integer NOT NULL,
 PRIMARY KEY(workspace_id,session_id,fact_id),
 FOREIGN KEY(workspace_id,session_id) REFERENCES interview_sessions(workspace_id,id),
 FOREIGN KEY(workspace_id,fact_id) REFERENCES candidate_facts(workspace_id,id),
 FOREIGN KEY(workspace_id,source_id) REFERENCES candidate_sources(workspace_id,id)
);
CREATE INDEX interview_source_refs ON interview_evidence(workspace_id,source_id);
CREATE TABLE interview_attempts (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, session_id uuid NOT NULL, text text NOT NULL,
 hypothetical boolean NOT NULL, local_checks jsonb NOT NULL, model_consent boolean NOT NULL DEFAULT false,
 status text NOT NULL CHECK(status IN ('saved','model_unconfigured','queued','running','completed','failed','cancelled','interrupted','invalidated')),
 auth_session_id uuid, work_id uuid, model text, provider text,
 feedback jsonb, accounting jsonb, usage jsonb, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,session_id) REFERENCES interview_sessions(workspace_id,id),
 FOREIGN KEY(workspace_id,work_id) REFERENCES work_items(workspace_id,id),
 FOREIGN KEY(workspace_id,auth_session_id) REFERENCES sessions(workspace_id,id),
 CHECK(status <> 'completed' OR feedback IS NOT NULL)
);
CREATE INDEX interview_attempt_order ON interview_attempts(workspace_id,session_id,created_at,id);

-- Invalidation belongs beside the dependent data; no parallel candidate writer is introduced.
CREATE FUNCTION retire_interview_records(w uuid, ids uuid[], erase boolean, reason text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
 UPDATE interview_sessions SET status=CASE WHEN erase THEN 'deleted' ELSE 'stale' END,
  snapshot='{}',revision=revision+1,updated_at=now()
  WHERE workspace_id=w AND id=ANY(ids) AND status<>'deleted';
 UPDATE interview_attempts SET status='invalidated',feedback=null,model_consent=false,
  text=CASE WHEN erase THEN '' ELSE text END,local_checks=CASE WHEN erase THEN '[]'::jsonb ELSE local_checks END,
  error_code=reason,completed_at=now()
  WHERE workspace_id=w AND session_id=ANY(ids);
 UPDATE work_items SET status='cancelled',error_code=reason,lease_until=null,updated_at=now()
  WHERE workspace_id=w AND kind='interview_feedback' AND input->>'sessionId'=ANY(ids::text[])
  AND status IN ('queued','leased');
END $$;
CREATE FUNCTION invalidate_interview_sources() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ids uuid[];
BEGIN
 IF TG_TABLE_NAME='candidates' THEN
  IF NEW.revision=OLD.revision AND NEW.ownership=OLD.ownership THEN RETURN NEW; END IF;
  SELECT array_agg(id) INTO ids FROM interview_sessions WHERE workspace_id=NEW.workspace_id AND status='active';
  PERFORM retire_interview_records(NEW.workspace_id,ids,false,'candidate_changed');
 ELSIF TG_TABLE_NAME='jobs' THEN
  IF NEW.revision=OLD.revision AND NEW.archived=OLD.archived THEN RETURN NEW; END IF;
  SELECT array_agg(id) INTO ids FROM interview_sessions WHERE workspace_id=NEW.workspace_id AND job_id=NEW.id AND status='active';
  PERFORM retire_interview_records(NEW.workspace_id,ids,false,'role_changed');
 ELSIF TG_TABLE_NAME='candidate_sources' THEN
  IF NEW.revision=OLD.revision AND NEW.model_consent=OLD.model_consent AND NEW.consent_revision=OLD.consent_revision
   AND NEW.classification=OLD.classification AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN RETURN NEW; END IF;
  SELECT array_agg(session_id) INTO ids FROM interview_evidence WHERE workspace_id=NEW.workspace_id AND source_id=NEW.id;
  PERFORM retire_interview_records(NEW.workspace_id,ids,NEW.deleted_at IS NOT NULL OR NOT NEW.model_consent OR NEW.classification='restricted','source_unavailable');
 ELSE
  IF NEW.revision=OLD.revision AND NEW.status=OLD.status AND NEW.sensitivity=OLD.sensitivity
   AND NEW.value IS NOT DISTINCT FROM OLD.value AND NEW.source_id=OLD.source_id AND NEW.source_revision=OLD.source_revision THEN RETURN NEW; END IF;
  SELECT array_agg(session_id) INTO ids FROM interview_evidence WHERE workspace_id=NEW.workspace_id AND fact_id=NEW.id;
  PERFORM retire_interview_records(NEW.workspace_id,ids,NEW.status='withdrawn' OR NEW.sensitivity<>'standard','fact_changed');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER interview_candidate_change AFTER UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION invalidate_interview_sources();
CREATE TRIGGER interview_role_change AFTER UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION invalidate_interview_sources();
CREATE TRIGGER interview_source_change AFTER UPDATE ON candidate_sources FOR EACH ROW EXECUTE FUNCTION invalidate_interview_sources();
CREATE TRIGGER interview_fact_change AFTER UPDATE ON candidate_facts FOR EACH ROW EXECUTE FUNCTION invalidate_interview_sources();
