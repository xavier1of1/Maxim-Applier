CREATE TABLE discord_settings (
 workspace_id uuid PRIMARY KEY REFERENCES workspaces(id), revision integer NOT NULL DEFAULT 1,
 destination_revision integer NOT NULL DEFAULT 0, destination_hash text, secret_ref uuid,
 confirmed_at timestamptz, enabled boolean NOT NULL DEFAULT false,
 contents text[] NOT NULL DEFAULT '{}', next_send_at timestamptz,
 CHECK(NOT enabled OR (secret_ref IS NOT NULL AND confirmed_at IS NOT NULL)),
 CHECK(contents <@ ARRAY['application_review','weekly_review','resume_review','high_fit','needs_response','networking_review','recruiter_reminder']::text[])
);
CREATE TABLE discord_schedules (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES discord_settings(workspace_id),
 kind text NOT NULL CHECK(kind IN ('application_review','weekly_review','resume_review')),
 revision integer NOT NULL DEFAULT 1, enabled boolean NOT NULL DEFAULT false,
 timezone text NOT NULL, anchor_date date NOT NULL, local_time text NOT NULL,
 next_due_at timestamptz NOT NULL, last_slot_at timestamptz,
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,kind)
);
CREATE TABLE discord_notifications (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES discord_settings(workspace_id),
 kind text NOT NULL, entity_id uuid, notification_key text NOT NULL, payload_revision integer NOT NULL DEFAULT 1,
 destination_hash text NOT NULL, destination_revision integer NOT NULL,
 planned_due_at timestamptz NOT NULL, available_at timestamptz NOT NULL,
 payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','sending','retry','accepted','uncertain','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 work_id uuid, active_token uuid, accepted_at timestamptz, remote_message_id text,
 error_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,destination_hash,notification_key,payload_revision),
 FOREIGN KEY(workspace_id,work_id) REFERENCES work_items(workspace_id,id),
 CHECK(status <> 'accepted' OR (accepted_at IS NOT NULL AND remote_message_id IS NOT NULL))
);
CREATE TABLE discord_attempts (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, notification_id uuid NOT NULL,
 attempt integer NOT NULL CHECK(attempt BETWEEN 1 AND 5), lease_token uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('sending','accepted','rejected','uncertain')),
 http_status integer, error_code text, retry_at timestamptz,
 started_at timestamptz NOT NULL, completed_at timestamptz,
 UNIQUE(workspace_id,notification_id,attempt),
 FOREIGN KEY(workspace_id,notification_id) REFERENCES discord_notifications(workspace_id,id)
);
CREATE INDEX discord_notification_due ON discord_notifications(workspace_id,status,available_at);
CREATE INDEX discord_schedule_due ON discord_schedules(workspace_id,next_due_at) WHERE enabled;
