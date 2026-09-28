-- Align persistent schemas with the current Pages and Actions runtime.
CREATE TABLE IF NOT EXISTS pages_sites (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  project_name TEXT NOT NULL UNIQUE,
  framework TEXT NOT NULL,
  build_command TEXT NOT NULL DEFAULT '',
  output_dir TEXT NOT NULL DEFAULT '',
  root_dir TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT 'main',
  cloudflare_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pages_sites_owner ON pages_sites(owner_id);
CREATE INDEX IF NOT EXISTS idx_pages_sites_repo ON pages_sites(repo_id);

ALTER TABLE action_runs ADD COLUMN owner_id TEXT;
CREATE INDEX IF NOT EXISTS idx_action_runs_owner_number
  ON action_runs(owner_id, run_number DESC);
