CREATE TABLE networking_imports (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 kind text NOT NULL CHECK(kind IN ('contacts','history')), source_key text NOT NULL,
 name text NOT NULL, content_hash text NOT NULL, raw_bytes bytea NOT NULL CHECK(octet_length(raw_bytes) BETWEEN 1 AND 2097152),
 row_count integer NOT NULL CHECK(row_count BETWEEN 0 AND 5000), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,kind,source_key,content_hash)
);
CREATE TABLE networking_contacts (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), identity_key text NOT NULL,
 revision integer NOT NULL DEFAULT 1, fields jsonb NOT NULL, strength integer CHECK(strength BETWEEN 1 AND 3),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id), UNIQUE(workspace_id,identity_key)
);
CREATE TABLE networking_import_rows (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, import_id uuid NOT NULL, row_number integer NOT NULL,
 raw_fields jsonb NOT NULL, raw_values jsonb NOT NULL, normalized jsonb NOT NULL,
 contact_id uuid, revision integer NOT NULL DEFAULT 1, resolution jsonb,
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,import_id,row_number),
 FOREIGN KEY(workspace_id,import_id) REFERENCES networking_imports(workspace_id,id),
 FOREIGN KEY(workspace_id,contact_id) REFERENCES networking_contacts(workspace_id,id)
);
CREATE TABLE networking_targets (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, job_id uuid NOT NULL, contact_id uuid NOT NULL,
 revision integer NOT NULL DEFAULT 1, rank_score integer NOT NULL, reasons jsonb NOT NULL,
 research jsonb, draft jsonb, status text NOT NULL DEFAULT 'research_needed'
 CHECK(status IN ('research_needed','draft_review','ready_to_send','sent_manually','replied','follow_up_due','referral_asked','referred','declined','no_response')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,job_id,contact_id),
 FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id),
 FOREIGN KEY(workspace_id,contact_id) REFERENCES networking_contacts(workspace_id,id)
);
CREATE TABLE networking_recruiter_tasks (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), source_key text NOT NULL,
 revision integer NOT NULL DEFAULT 1, subject text NOT NULL, tags text[] NOT NULL DEFAULT '{}',
 needs_response boolean NOT NULL DEFAULT false, last_evidence_at timestamptz NOT NULL,
 resolved_through timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,source_key)
);
CREATE TABLE networking_recruiter_evidence (
 workspace_id uuid NOT NULL, evidence_key text NOT NULL, task_id uuid NOT NULL, observed_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,evidence_key),
 FOREIGN KEY(workspace_id,task_id) REFERENCES networking_recruiter_tasks(workspace_id,id)
);
CREATE TABLE networking_history_attempts (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), identity_key text NOT NULL,
 row_id uuid NOT NULL, application_id uuid, revision integer NOT NULL DEFAULT 1,
 reviewed jsonb NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,identity_key), UNIQUE(workspace_id,row_id),
 FOREIGN KEY(workspace_id,row_id) REFERENCES networking_import_rows(workspace_id,id),
 FOREIGN KEY(workspace_id,application_id) REFERENCES applications(workspace_id,id)
);
CREATE TABLE networking_history_reviews (
 workspace_id uuid NOT NULL, attempt_id uuid NOT NULL, revision integer NOT NULL,
 reviewed jsonb NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,attempt_id,revision),
 FOREIGN KEY(workspace_id,attempt_id) REFERENCES networking_history_attempts(workspace_id,id)
);
CREATE INDEX networking_rows_page ON networking_import_rows(workspace_id,import_id,row_number);
CREATE INDEX networking_targets_queue ON networking_targets(workspace_id,updated_at DESC);
