-- Upgrades a database created with the first schema (single claim per wish) to the current one.
ALTER TABLE wishes ADD COLUMN price_cents INTEGER;
ALTER TABLE wishes ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wishes ADD COLUMN image_url TEXT;

CREATE TABLE claims_new (
  wish_id INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bought INTEGER NOT NULL DEFAULT 0,
  wrapped INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (wish_id, user_id)
);
INSERT INTO claims_new (wish_id, user_id, created_at) SELECT wish_id, user_id, created_at FROM claims;
DROP TABLE claims;
ALTER TABLE claims_new RENAME TO claims;

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wish_id INTEGER NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_wish ON notes(wish_id);
