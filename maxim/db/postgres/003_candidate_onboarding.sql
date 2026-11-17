ALTER TABLE candidates ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE candidates ADD COLUMN ownership text NOT NULL DEFAULT 'legacy' CHECK(ownership IN ('legacy','staging','canonical'));
ALTER TABLE artifacts ALTER COLUMN job_id DROP NOT NULL;
ALTER TABLE artifacts ADD COLUMN deleted_at timestamptz;
CREATE TABLE candidate_sources(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),artifact_id uuid,
 name text NOT NULL,format text NOT NULL,content_hash text NOT NULL,revision integer NOT NULL DEFAULT 1,
 classification text NOT NULL CHECK(classification IN ('personal','public','restricted')),
 model_consent boolean NOT NULL DEFAULT false,consent_revision integer NOT NULL DEFAULT 1,status text NOT NULL DEFAULT 'queued'
 CHECK(status IN ('queued','running','review_required','approved','reviewed','failed','deleted')),
 extracted_text text,extraction_error text,origin_run uuid,retention_days integer NOT NULL DEFAULT 30 CHECK(retention_days BETWEEN 1 AND 365),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,
 UNIQUE(workspace_id,id),UNIQUE(workspace_id,content_hash),
 FOREIGN KEY(workspace_id,artifact_id) REFERENCES artifacts(workspace_id,id),
 FOREIGN KEY(workspace_id,origin_run) REFERENCES runs(workspace_id,id)
);
CREATE TABLE fact_proposals(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,source_id uuid NOT NULL,source_revision integer NOT NULL,
 field_key text NOT NULL,value jsonb NOT NULL,quote text NOT NULL,expected_fact_revision integer NOT NULL DEFAULT 0,
 revision integer NOT NULL DEFAULT 1,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','withdrawn')),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,source_id) REFERENCES candidate_sources(workspace_id,id)
);
CREATE TABLE candidate_facts(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),field_key text NOT NULL,
 value jsonb NOT NULL,revision integer NOT NULL DEFAULT 1,source_id uuid NOT NULL,source_revision integer NOT NULL,
 sensitivity text NOT NULL CHECK(sensitivity IN ('standard','private','sensitive')),
 status text NOT NULL DEFAULT 'current' CHECK(status IN ('current','withdrawn')),
 approved_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),UNIQUE(workspace_id,field_key),
 FOREIGN KEY(workspace_id,source_id) REFERENCES candidate_sources(workspace_id,id)
);
CREATE TABLE fact_versions(
 workspace_id uuid NOT NULL,fact_id uuid NOT NULL,revision integer NOT NULL,value jsonb,
 source_id uuid NOT NULL,source_revision integer NOT NULL,status text NOT NULL,reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,fact_id,revision),
 FOREIGN KEY(workspace_id,fact_id) REFERENCES candidate_facts(workspace_id,id)
);
CREATE TABLE candidate_contexts(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),candidate_revision integer NOT NULL,
 content jsonb NOT NULL,status text NOT NULL DEFAULT 'current' CHECK(status IN ('current','invalidated')),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id)
);
CREATE TABLE fact_dependencies(
 workspace_id uuid NOT NULL,fact_id uuid NOT NULL,fact_revision integer NOT NULL,
 kind text NOT NULL CHECK(kind IN ('context','answer','draft','packet')),entity_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'current' CHECK(status IN ('current','invalidated')),
 PRIMARY KEY(workspace_id,fact_id,kind,entity_id),
 FOREIGN KEY(workspace_id,fact_id) REFERENCES candidate_facts(workspace_id,id)
);
CREATE TABLE work_items(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),kind text NOT NULL,dedupe_key text NOT NULL,
 input jsonb NOT NULL,status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','leased','completed','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0,max_attempts integer NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 5),
 lease_token uuid,lease_owner text,lease_until timestamptz,available_at timestamptz NOT NULL DEFAULT now(),
 result jsonb,error_code text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),UNIQUE(workspace_id,kind,dedupe_key)
);
CREATE INDEX work_claim_ready ON work_items(status,available_at,lease_until);
CREATE TABLE worker_heartbeats(worker_id text PRIMARY KEY,last_seen timestamptz NOT NULL DEFAULT now());
CREATE TABLE ownership_transitions(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),family text NOT NULL,
 status text NOT NULL CHECK(status IN ('staging','active','rolled_back')),candidate_revision integer NOT NULL,
 manifest jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id)
);
