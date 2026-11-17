CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE workspaces (id uuid PRIMARY KEY, name text NOT NULL, is_owner boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE candidates (id uuid PRIMARY KEY, workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id), display_name text NOT NULL);
CREATE TABLE access_keys (key_hash text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sessions (id uuid PRIMARY KEY, token_hash text UNIQUE NOT NULL, workspace_id uuid NOT NULL REFERENCES workspaces(id), csrf_token text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE jobs (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), company text NOT NULL, title text NOT NULL,
 location text NOT NULL DEFAULT '', url text, description text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '',
 archived boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id)
);
CREATE TABLE job_aliases (workspace_id uuid NOT NULL, job_id uuid NOT NULL, source text NOT NULL, external_id text NOT NULL,
 PRIMARY KEY(workspace_id,source,external_id), FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id));
CREATE TABLE applications (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), job_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'intent' CHECK(status IN ('intent','archived')), revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,job_id), UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id)
);
CREATE TABLE commands (workspace_id uuid NOT NULL REFERENCES workspaces(id), command_id uuid NOT NULL,
 payload_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,command_id));
CREATE TABLE events (sequence bigserial PRIMARY KEY, id uuid UNIQUE NOT NULL, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 entity_id uuid NOT NULL, event_type text NOT NULL, revision integer, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE outbox (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), event_id uuid NOT NULL REFERENCES events(id),
 status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE conversations (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), title text NOT NULL,
 job_id uuid, active_run uuid, lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id));
CREATE TABLE runs (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, conversation_id uuid NOT NULL, payload_hash text NOT NULL,
 status text NOT NULL CHECK(status IN ('running','completed','failed','cancelled')), error_code text, usage jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 FOREIGN KEY(workspace_id,conversation_id) REFERENCES conversations(workspace_id,id), UNIQUE(workspace_id,id));
CREATE TABLE messages (sequence bigserial PRIMARY KEY, id uuid UNIQUE NOT NULL, workspace_id uuid NOT NULL, conversation_id uuid NOT NULL,
 run_id uuid, role text NOT NULL, content jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,conversation_id) REFERENCES conversations(workspace_id,id));
CREATE TABLE proposals (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, session_id uuid NOT NULL REFERENCES sessions(id),
 job_id uuid NOT NULL, run_id uuid, expected_revision integer NOT NULL, note text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','cancelled')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz,
 FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id));
CREATE TABLE artifacts (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), job_id uuid NOT NULL,
 name text NOT NULL, storage_key text NOT NULL UNIQUE, content_hash text NOT NULL, bytes integer NOT NULL CHECK(bytes>=0), content_type text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id), UNIQUE(workspace_id,id));
CREATE INDEX events_workspace_order ON events(workspace_id,sequence DESC);
CREATE INDEX messages_conversation_order ON messages(workspace_id,conversation_id,sequence);
