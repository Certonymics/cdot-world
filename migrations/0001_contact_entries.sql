-- Contact form entries (Cloudflare D1, which is SQLite).
--
-- Apply once per database: paste this into the D1 console in the Cloudflare
-- dashboard (Storage & Databases > D1 > your database > Console), or run
--   npx wrangler d1 execute <database-name> --remote --file=migrations/0001_contact_entries.sql
--
-- IF NOT EXISTS throughout, so running it twice is harmless.

CREATE TABLE IF NOT EXISTS contact_entries (
  id              TEXT    PRIMARY KEY,               -- random UUID
  created_at      TEXT    NOT NULL,                  -- ISO 8601, UTC
  email           TEXT    NOT NULL,                  -- as the visitor typed it, trimmed
  message         TEXT    NOT NULL,
  notified        INTEGER NOT NULL DEFAULT 0,        -- 1 once the notification email was accepted
  notify_attempts INTEGER NOT NULL DEFAULT 0,        -- stops retrying after a few failures
  source          TEXT    NOT NULL DEFAULT 'web'     -- 'web', or 'google-sheet' for imported rows
);

CREATE INDEX IF NOT EXISTS idx_contact_created       ON contact_entries (created_at);
CREATE INDEX IF NOT EXISTS idx_contact_email_created ON contact_entries (email, created_at);
