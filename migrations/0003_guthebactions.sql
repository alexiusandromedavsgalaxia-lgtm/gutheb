CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT NOT NULL,
  definition TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_actions_published_updated
  ON actions(published, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_actions_owner
  ON actions(owner_id);
