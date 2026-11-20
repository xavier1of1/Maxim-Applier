CREATE TABLE intelligence_job_holds(
 workspace_id uuid NOT NULL,job_id uuid NOT NULL,job_revision integer NOT NULL,
 candidate_revision integer NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,job_id),FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id)
);
CREATE TABLE discovery_source_cursors(
 workspace_id uuid NOT NULL,source_id uuid NOT NULL,record_offset bigint NOT NULL DEFAULT 0,
 PRIMARY KEY(workspace_id,source_id),FOREIGN KEY(workspace_id,source_id) REFERENCES discovery_sources(workspace_id,id)
);
