-- Bounded metadata only; never duplicate raw inventories or descriptions.
ALTER TABLE discovery_source_cursors ADD COLUMN posting_offsets jsonb NOT NULL DEFAULT '{}';
