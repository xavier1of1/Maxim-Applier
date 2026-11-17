ALTER TABLE sessions ADD CONSTRAINT sessions_workspace_identity UNIQUE(workspace_id,id);
ALTER TABLE events ADD CONSTRAINT events_workspace_identity UNIQUE(workspace_id,id);
ALTER TABLE messages ADD CONSTRAINT messages_scoped_run FOREIGN KEY(workspace_id,run_id) REFERENCES runs(workspace_id,id);
ALTER TABLE messages ADD CONSTRAINT messages_role CHECK(role IN ('user','assistant','tool'));
ALTER TABLE proposals ADD CONSTRAINT proposals_scoped_session FOREIGN KEY(workspace_id,session_id) REFERENCES sessions(workspace_id,id);
ALTER TABLE proposals ADD CONSTRAINT proposals_scoped_run FOREIGN KEY(workspace_id,run_id) REFERENCES runs(workspace_id,id);
ALTER TABLE proposals ADD CONSTRAINT proposals_positive_revision CHECK(expected_revision>0);
ALTER TABLE outbox ADD CONSTRAINT outbox_scoped_event FOREIGN KEY(workspace_id,event_id) REFERENCES events(workspace_id,id);
ALTER TABLE conversations ADD CONSTRAINT conversations_scoped_run FOREIGN KEY(workspace_id,active_run) REFERENCES runs(workspace_id,id);
