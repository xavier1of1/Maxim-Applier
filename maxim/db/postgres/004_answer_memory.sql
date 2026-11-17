CREATE TABLE answer_questions(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),company text NOT NULL,
 exact_text text NOT NULL,normalized_text text NOT NULL,kind text NOT NULL,fact_key text,
 context jsonb NOT NULL,context_hash text NOT NULL,tags text[] NOT NULL DEFAULT '{}',identity_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id),UNIQUE(workspace_id,identity_hash)
);
CREATE INDEX answer_question_lookup ON answer_questions(workspace_id,normalized_text,company);
CREATE INDEX answer_question_tags ON answer_questions USING gin(tags);
CREATE TABLE answer_memory(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,question_id uuid NOT NULL,revision integer NOT NULL DEFAULT 1,
 text text NOT NULL,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','invalidated','revoked','deleted')),
 permission text NOT NULL CHECK(permission IN ('company','cross_company','never')),
 sensitivity text NOT NULL CHECK(sensitivity IN ('standard','private','sensitive')),
 model_consent boolean NOT NULL DEFAULT false,sensitive_consent boolean NOT NULL DEFAULT false,
 candidate_revision integer NOT NULL,content_hash text NOT NULL,origin_run uuid,
 expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),FOREIGN KEY(workspace_id,question_id) REFERENCES answer_questions(workspace_id,id),
 FOREIGN KEY(workspace_id,origin_run) REFERENCES runs(workspace_id,id)
);
CREATE TABLE answer_versions(
 workspace_id uuid NOT NULL,answer_id uuid NOT NULL,revision integer NOT NULL,snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,answer_id,revision),
 FOREIGN KEY(workspace_id,answer_id) REFERENCES answer_memory(workspace_id,id)
);
CREATE TABLE answer_fact_refs(
 workspace_id uuid NOT NULL,answer_id uuid NOT NULL,answer_revision integer NOT NULL,
 fact_id uuid NOT NULL,fact_revision integer NOT NULL,
 PRIMARY KEY(workspace_id,answer_id,answer_revision,fact_id),
 FOREIGN KEY(workspace_id,answer_id,answer_revision) REFERENCES answer_versions(workspace_id,answer_id,revision),
 FOREIGN KEY(workspace_id,fact_id) REFERENCES candidate_facts(workspace_id,id)
);
CREATE TABLE answer_uses(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,answer_id uuid NOT NULL,answer_revision integer NOT NULL,question_id uuid NOT NULL,
 revision integer NOT NULL DEFAULT 1,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','invalidated','submitted')),
 snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),FOREIGN KEY(workspace_id,answer_id,answer_revision) REFERENCES answer_versions(workspace_id,answer_id,revision),
 FOREIGN KEY(workspace_id,question_id) REFERENCES answer_questions(workspace_id,id)
);
CREATE TABLE answer_dependencies(
 workspace_id uuid NOT NULL,answer_id uuid NOT NULL,answer_revision integer NOT NULL,kind text NOT NULL CHECK(kind IN ('draft','context','packet')),
 entity_id uuid NOT NULL,status text NOT NULL DEFAULT 'current' CHECK(status IN ('current','invalidated')),
 PRIMARY KEY(workspace_id,answer_id,kind,entity_id),
 FOREIGN KEY(workspace_id,answer_id) REFERENCES answer_memory(workspace_id,id)
);
ALTER TABLE runs ADD COLUMN context_accounting jsonb NOT NULL DEFAULT '[]';
ALTER TABLE runs ADD COLUMN candidate_revision integer;

