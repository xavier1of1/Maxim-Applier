ALTER TABLE discovery_attempts ADD COLUMN coverage jsonb NOT NULL DEFAULT '{}';
CREATE TABLE discovery_inventories(
 workspace_id uuid NOT NULL,source_id uuid NOT NULL,
 entries jsonb NOT NULL DEFAULT '[]',content_hash text NOT NULL,
 available integer NOT NULL CHECK(available>=0),record_offset integer NOT NULL DEFAULT 0 CHECK(record_offset>=0),
 fetched_at timestamptz NOT NULL DEFAULT now(),dataset_url text NOT NULL,
 PRIMARY KEY(workspace_id,source_id),
 FOREIGN KEY(workspace_id,source_id) REFERENCES discovery_sources(workspace_id,id)
);
CREATE TABLE discovery_search_profiles(
 workspace_id uuid PRIMARY KEY REFERENCES workspaces(id),revision integer NOT NULL DEFAULT 1,
 candidate_revision integer NOT NULL,value jsonb NOT NULL,approved_by uuid NOT NULL REFERENCES sessions(id),
 approved_at timestamptz NOT NULL DEFAULT now()
);
