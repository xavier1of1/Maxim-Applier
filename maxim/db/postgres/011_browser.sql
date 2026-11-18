CREATE TABLE browser_sessions (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 application_id uuid NOT NULL, packet_id uuid NOT NULL, candidate_revision integer NOT NULL,
 provider text NOT NULL, origin text NOT NULL, url text NOT NULL,
 status text NOT NULL DEFAULT 'queued', revision integer NOT NULL DEFAULT 1,
 actor_session uuid NOT NULL, worker_owner text, lease_until timestamptz,
 observation jsonb NOT NULL DEFAULT '{}', progress jsonb NOT NULL DEFAULT '{}',
 autosave_consent boolean NOT NULL DEFAULT false, private_consent boolean NOT NULL DEFAULT false,
 last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (workspace_id,application_id) REFERENCES applications(workspace_id,id),
 FOREIGN KEY (workspace_id,packet_id) REFERENCES application_packets(workspace_id,id),
 UNIQUE(workspace_id,id)
);
CREATE UNIQUE INDEX browser_one_owned_session ON browser_sessions(workspace_id)
 WHERE status IN ('queued','opening','observed','working','paused','review_ready','manual_handoff');
CREATE TABLE browser_actions (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, session_id uuid NOT NULL,
 command_id uuid NOT NULL, kind text NOT NULL, field_id text,
 status text NOT NULL DEFAULT 'queued', result jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 FOREIGN KEY (workspace_id,session_id) REFERENCES browser_sessions(workspace_id,id),
 UNIQUE(workspace_id,command_id)
);
