CREATE TABLE IF NOT EXISTS action_runs (
  id TEXT PRIMARY KEY,
  run_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  event TEXT NOT NULL,
  head_branch TEXT NOT NULL,
  status TEXT NOT NULL,
  conclusion TEXT,
  source TEXT NOT NULL,
  runner TEXT NOT NULL,
  yuml TEXT NOT NULL,
  yuml_plan TEXT NOT NULL,
  jobs TEXT NOT NULL,
  artifacts TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_action_runs_number
  ON action_runs(run_number DESC);