PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS career_ops_evaluations (
  id TEXT PRIMARY KEY,
  report_path TEXT,
  pdf_path TEXT,
  company TEXT,
  role TEXT,
  score REAL,
  source TEXT,
  job_url TEXT,
  location_text TEXT,
  salary_text TEXT,
  posted_at TEXT,
  summary TEXT,
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS career_ops_artifacts (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT,
  artifact_type TEXT NOT NULL,
  path TEXT NOT NULL,
  exists_on_disk INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(artifact_type, path)
);

CREATE TABLE IF NOT EXISTS maxim_jobs (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT,
  company TEXT,
  role TEXT,
  tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'synced',
  next_action TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  career_ops_score REAL,
  priority_overlay INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(evaluation_id)
);

CREATE TABLE IF NOT EXISTS priority_flags (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  career_ops_row_key TEXT,
  company TEXT,
  role TEXT,
  status TEXT NOT NULL,
  applied_at TEXT,
  score REAL,
  tier TEXT,
  source TEXT,
  pdf_path TEXT,
  report_path TEXT,
  job_url TEXT,
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  title TEXT,
  linkedin_url TEXT,
  email TEXT,
  connection_strength INTEGER,
  vt_alumni INTEGER NOT NULL DEFAULT 0,
  recruiter_signal INTEGER NOT NULL DEFAULT 0,
  founder_signal INTEGER NOT NULL DEFAULT 0,
  role_relevance TEXT,
  source TEXT,
  notes TEXT,
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS target_companies (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  priority TEXT,
  source_preference TEXT,
  connection_strength INTEGER,
  location_focus TEXT,
  role_lanes TEXT,
  notes TEXT,
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(company)
);

CREATE TABLE IF NOT EXISTS networking_targets (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  rank_score REAL NOT NULL,
  ranking_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready_to_research',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(job_id, contact_id)
);

CREATE TABLE IF NOT EXISTS message_drafts (
  id TEXT PRIMARY KEY,
  target_id TEXT,
  job_id TEXT,
  contact_id TEXT,
  channel TEXT NOT NULL,
  draft_text TEXT NOT NULL,
  cta TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready_to_send',
  validation_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recruiter_threads (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'manual',
  subject TEXT NOT NULL,
  company TEXT,
  status TEXT NOT NULL,
  needs_response INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  last_activity_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  immediate INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  scheduled_for TEXT,
  sent_at TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id TEXT PRIMARY KEY,
  period_start TEXT,
  period_end TEXT,
  primary_kpi REAL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_decisions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  reason TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS historical_import_batches (
  id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  raw_copy_path TEXT,
  started_at TEXT NOT NULL,
  raw_row_count INTEGER NOT NULL,
  normalized_row_count INTEGER NOT NULL,
  issue_count INTEGER NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS historical_application_raw_rows (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  raw_payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS historical_application_normalized_rows (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  company TEXT,
  role TEXT,
  source TEXT,
  link TEXT,
  salary TEXT,
  date_submitted TEXT,
  interview_round TEXT,
  application_status_raw TEXT,
  interview_signal INTEGER NOT NULL DEFAULT 0,
  normalized_outcome TEXT NOT NULL,
  issues_json TEXT NOT NULL DEFAULT '[]'
);
