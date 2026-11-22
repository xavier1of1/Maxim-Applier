-- Sessions are ephemeral; approval actor IDs are historical audit evidence.
ALTER TABLE discovery_search_profiles DROP CONSTRAINT discovery_search_profiles_approved_by_fkey;
CREATE TABLE discovery_profile_proposals(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),run_id uuid NOT NULL,
 expected_revision integer NOT NULL,candidate_revision integer NOT NULL,value jsonb NOT NULL,
 quote text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,run_id),
 FOREIGN KEY(workspace_id,run_id) REFERENCES runs(workspace_id,id)
);
