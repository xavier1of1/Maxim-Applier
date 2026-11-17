ALTER TABLE jobs ADD COLUMN opening_key text;
ALTER TABLE jobs ADD COLUMN source_platform text;
ALTER TABLE jobs ADD COLUMN application_url text;
ALTER TABLE jobs ADD COLUMN posted_at timestamptz;
ALTER TABLE jobs ADD COLUMN source_updated_at timestamptz;
ALTER TABLE jobs ADD COLUMN first_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE jobs ADD COLUMN last_seen_at timestamptz;
ALTER TABLE jobs ADD COLUMN discovery_policy jsonb NOT NULL DEFAULT '{}';
UPDATE jobs SET first_seen_at=created_at;
CREATE UNIQUE INDEX jobs_opening_identity ON jobs(workspace_id,opening_key) WHERE opening_key IS NOT NULL;

CREATE TABLE discovery_sources(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),name text NOT NULL,
 provider text NOT NULL,board text NOT NULL DEFAULT '',careers_url text NOT NULL,
 enabled boolean NOT NULL DEFAULT true,revision integer NOT NULL DEFAULT 1,identity_hash text NOT NULL,
 status text NOT NULL DEFAULT 'not_checked',status_reason text,checked_at timestamptz,next_retry_at timestamptz,
 native_definition jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),UNIQUE(workspace_id,identity_hash)
);
CREATE TABLE discovery_queries(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),version integer NOT NULL DEFAULT 1,
 terms text[] NOT NULL,filters jsonb NOT NULL,source_snapshots jsonb NOT NULL,
 candidate_revision integer,preference_provenance jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id)
);
CREATE TABLE discovery_runs(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,query_id uuid NOT NULL,revision integer NOT NULL DEFAULT 1,work_id uuid,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','partial','failed','cancelled')),
 counts jsonb NOT NULL DEFAULT '{}',error_code text,started_at timestamptz,completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,query_id) REFERENCES discovery_queries(workspace_id,id),
 FOREIGN KEY(workspace_id,work_id) REFERENCES work_items(workspace_id,id)
);
CREATE TABLE discovery_attempts(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,run_id uuid NOT NULL,source_id uuid NOT NULL,
 run_revision integer NOT NULL,source_revision integer NOT NULL,status text NOT NULL DEFAULT 'pending',
 error_code text,fallback text,record_count integer NOT NULL DEFAULT 0,page_count integer NOT NULL DEFAULT 0,
 started_at timestamptz,completed_at timestamptz,UNIQUE(workspace_id,id),
 UNIQUE(workspace_id,run_id,source_id,run_revision),
 FOREIGN KEY(workspace_id,run_id) REFERENCES discovery_runs(workspace_id,id),
 FOREIGN KEY(workspace_id,source_id) REFERENCES discovery_sources(workspace_id,id)
);
CREATE TABLE discovery_pages(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,run_id uuid NOT NULL,source_id uuid NOT NULL,attempt_id uuid NOT NULL,
 source_revision integer NOT NULL,page_number integer NOT NULL,request_url text NOT NULL,
 payload jsonb NOT NULL,content_hash text NOT NULL,record_count integer NOT NULL,
 captured_at timestamptz NOT NULL,cached_from uuid,complete boolean NOT NULL,
 UNIQUE(workspace_id,id),UNIQUE(workspace_id,attempt_id,page_number),
 FOREIGN KEY(workspace_id,run_id) REFERENCES discovery_runs(workspace_id,id),
 FOREIGN KEY(workspace_id,source_id) REFERENCES discovery_sources(workspace_id,id),
 FOREIGN KEY(workspace_id,attempt_id) REFERENCES discovery_attempts(workspace_id,id),
 FOREIGN KEY(workspace_id,cached_from) REFERENCES discovery_pages(workspace_id,id)
);
CREATE TABLE discovery_requests(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,run_id uuid NOT NULL,source_id uuid NOT NULL,attempt_id uuid NOT NULL,
 request_url text NOT NULL,status text NOT NULL,http_status integer,bytes integer,error_code text,
 fixture_transport boolean NOT NULL,started_at timestamptz NOT NULL,completed_at timestamptz,
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,run_id) REFERENCES discovery_runs(workspace_id,id),
 FOREIGN KEY(workspace_id,source_id) REFERENCES discovery_sources(workspace_id,id),
 FOREIGN KEY(workspace_id,attempt_id) REFERENCES discovery_attempts(workspace_id,id)
);
CREATE TABLE discovery_host_pacing(host text PRIMARY KEY,next_at timestamptz NOT NULL);
CREATE TABLE job_source_aliases(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,job_id uuid NOT NULL,source_id uuid NOT NULL,
 external_id text NOT NULL,original_url text NOT NULL,application_url text,platform text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id),UNIQUE(workspace_id,source_id,external_id),
 FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id),
 FOREIGN KEY(workspace_id,source_id) REFERENCES discovery_sources(workspace_id,id)
);
CREATE TABLE job_observations(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,job_id uuid NOT NULL,source_id uuid NOT NULL,run_id uuid NOT NULL,
 page_id uuid NOT NULL,external_id text NOT NULL,raw_fields jsonb NOT NULL,content_hash text NOT NULL,
 source_revision integer NOT NULL,observed_at timestamptz NOT NULL,posted_at timestamptz,
 date_basis text NOT NULL,policy jsonb NOT NULL,identity_conflict boolean NOT NULL DEFAULT false,
 UNIQUE(workspace_id,id),UNIQUE(workspace_id,run_id,source_id,external_id),
 FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id),
 FOREIGN KEY(workspace_id,source_id) REFERENCES discovery_sources(workspace_id,id),
 FOREIGN KEY(workspace_id,run_id) REFERENCES discovery_runs(workspace_id,id),
 FOREIGN KEY(workspace_id,page_id) REFERENCES discovery_pages(workspace_id,id)
);
CREATE TABLE job_discovery_states(
 workspace_id uuid NOT NULL,job_id uuid NOT NULL,state text NOT NULL DEFAULT 'none' CHECK(state IN ('none','saved','dismissed')),
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,job_id),
 FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id)
);
CREATE INDEX discovery_page_resume ON discovery_pages(workspace_id,run_id,source_id,source_revision,page_number,captured_at);
CREATE INDEX discovery_observation_history ON job_observations(workspace_id,job_id,observed_at);

