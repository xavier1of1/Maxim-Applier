CREATE TABLE gmail_accounts (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), expected_email text NOT NULL,
 email text, status text NOT NULL DEFAULT 'disconnected'
 CHECK(status IN ('disconnected','authorizing','connected','revoking','revoked','error')),
 enabled boolean NOT NULL DEFAULT false, thread_ids text[] NOT NULL,
 lookback_days integer NOT NULL CHECK(lookback_days BETWEEN 1 AND 30),
 retention_days integer NOT NULL CHECK(retention_days BETWEEN 1 AND 30),
 retain_body boolean NOT NULL DEFAULT false, model_disclosure boolean NOT NULL DEFAULT false,
 consent_at timestamptz NOT NULL DEFAULT now(), token_key uuid,
 checkpoint jsonb NOT NULL DEFAULT '{}', last_success_at timestamptz, error_code text,
 next_retry_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), CHECK(cardinality(thread_ids) BETWEEN 1 AND 5),
 CHECK(NOT model_disclosure OR retain_body)
);
CREATE TABLE gmail_oauth_states (
 state_hash text PRIMARY KEY, workspace_id uuid NOT NULL, account_id uuid NOT NULL,
 account_revision integer NOT NULL, session_id uuid NOT NULL REFERENCES sessions(id),
 secret_key uuid NOT NULL, expires_at timestamptz NOT NULL,
 FOREIGN KEY(workspace_id,account_id) REFERENCES gmail_accounts(workspace_id,id)
);
CREATE TABLE gmail_revocations (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, account_id uuid NOT NULL,
 token_key uuid NOT NULL UNIQUE, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','revoked')),
 error_code text, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,account_id) REFERENCES gmail_accounts(workspace_id,id)
);
CREATE TABLE gmail_observations (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, account_id uuid NOT NULL,
 message_id text NOT NULL, thread_id text NOT NULL, content_revision text NOT NULL,
 source_url text NOT NULL, received_at timestamptz NOT NULL, observed_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, direction text NOT NULL CHECK(direction IN ('incoming','outgoing','unknown')),
 headers jsonb NOT NULL DEFAULT '{}', body text,
 message_header_id text, in_reply_to text, withdrawn boolean NOT NULL DEFAULT false,
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,account_id,message_id,content_revision),
 FOREIGN KEY(workspace_id,account_id) REFERENCES gmail_accounts(workspace_id,id)
);
CREATE TABLE gmail_links (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, observation_id uuid NOT NULL,
 application_id uuid NOT NULL, application_revision integer NOT NULL,
 job_revision integer NOT NULL, revision integer NOT NULL DEFAULT 1,
 confidence text NOT NULL CHECK(confidence IN ('identifier','human')),
 reviewer_session uuid NOT NULL REFERENCES sessions(id), reason text NOT NULL,
 withdrawn_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,observation_id) REFERENCES gmail_observations(workspace_id,id),
 FOREIGN KEY(workspace_id,application_id) REFERENCES applications(workspace_id,id)
);
CREATE UNIQUE INDEX gmail_one_current_link ON gmail_links(workspace_id,observation_id) WHERE withdrawn_at IS NULL;
CREATE TABLE gmail_response_tasks (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, link_id uuid NOT NULL,
 observation_id uuid NOT NULL, application_id uuid NOT NULL,
 revision integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'open'
 CHECK(status IN ('open','resolved','withdrawn')),
 resolution text, resolved_by uuid, reply_observation_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,observation_id),
 FOREIGN KEY(workspace_id,link_id) REFERENCES gmail_links(workspace_id,id),
 FOREIGN KEY(workspace_id,observation_id) REFERENCES gmail_observations(workspace_id,id),
 FOREIGN KEY(workspace_id,application_id) REFERENCES applications(workspace_id,id),
 FOREIGN KEY(workspace_id,reply_observation_id) REFERENCES gmail_observations(workspace_id,id)
);
CREATE INDEX gmail_observation_inbox ON gmail_observations(workspace_id,observed_at DESC);
CREATE INDEX gmail_task_inbox ON gmail_response_tasks(workspace_id,status);
