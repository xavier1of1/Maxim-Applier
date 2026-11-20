CREATE TABLE discovery_policies(
 workspace_id uuid PRIMARY KEY REFERENCES workspaces(id),revision integer NOT NULL DEFAULT 1,
 value jsonb NOT NULL,next_scan_at timestamptz NOT NULL DEFAULT now(),next_score_at timestamptz NOT NULL DEFAULT now(),
 next_cleanup_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE intelligence_cycles(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),policy_revision integer NOT NULL,
 status text NOT NULL DEFAULT 'queued',kind text NOT NULL,work_id uuid,run_ids uuid[] NOT NULL DEFAULT '{}',
 receipt jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 UNIQUE(workspace_id,id)
);
CREATE TABLE evaluation_reservations(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),cycle_id uuid NOT NULL,evaluation_id uuid,
 policy_revision integer NOT NULL,model text NOT NULL,api text NOT NULL,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','sending','settled','uncertain','released')),
 reserved_cents numeric NOT NULL CHECK(reserved_cents>=0),charged_cents numeric,
 reserved_tokens integer NOT NULL,usage jsonb,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,evaluation_id),FOREIGN KEY(workspace_id,cycle_id) REFERENCES intelligence_cycles(workspace_id,id)
);
CREATE TABLE job_archive(
 workspace_id uuid NOT NULL,job_id uuid NOT NULL,title text NOT NULL,company text NOT NULL,
 posted_at timestamptz,first_seen_at timestamptz,last_seen_at timestamptz,location text,url text,source text,
 qualifications text NOT NULL DEFAULT '',score numeric,tier text,score_current boolean NOT NULL DEFAULT false,
 candidate_revision integer,industry text,role_lane text,reason text NOT NULL,archived_at timestamptz NOT NULL DEFAULT now(),
 restored_at timestamptz,PRIMARY KEY(workspace_id,job_id),FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id)
);
CREATE TABLE intelligence_proposals(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),expected_revision integer NOT NULL,
 changes jsonb NOT NULL,reason text NOT NULL,status text NOT NULL DEFAULT 'pending',created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE jobs ADD COLUMN industry text;
ALTER TABLE jobs ADD COLUMN industry_provenance text;
ALTER TABLE jobs ADD COLUMN role_lane text;
ALTER TABLE jobs ADD COLUMN compacted_at timestamptz;
ALTER TABLE discovery_sources ADD COLUMN industry text;
ALTER TABLE discovery_runs ADD COLUMN raw_compacted_at timestamptz;
CREATE INDEX intelligence_due ON discovery_policies(next_scan_at,next_score_at);
CREATE INDEX intelligence_history ON intelligence_cycles(workspace_id,created_at DESC);
CREATE INDEX reservation_budget ON evaluation_reservations(workspace_id,created_at,status);
CREATE INDEX archived_jobs_history ON job_archive(workspace_id,archived_at DESC,job_id);
CREATE INDEX job_filter_posted ON jobs(workspace_id,archived,posted_at DESC);
CREATE UNIQUE INDEX automatic_evaluation_single_lease ON work_items(workspace_id)
 WHERE status='leased' AND input ? 'autoReservationId';
