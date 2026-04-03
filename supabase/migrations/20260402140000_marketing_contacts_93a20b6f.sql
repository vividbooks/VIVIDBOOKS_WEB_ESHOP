-- Lokální kopie Mailchimp audience pro marketing admin (filtry škola, tagy, …).
-- Sync přes Edge funkci make-server-93a20b6f (service role); z frontendu jen přes API.

CREATE TABLE IF NOT EXISTS marketing_contacts_93a20b6f (
  email_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  list_id TEXT NOT NULL,
  status TEXT,
  merge_fields JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  school TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_contacts_school_lower
  ON marketing_contacts_93a20b6f (lower(school));
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_email_lower
  ON marketing_contacts_93a20b6f (lower(email));
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_tags_gin
  ON marketing_contacts_93a20b6f USING GIN (tags);

ALTER TABLE marketing_contacts_93a20b6f ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE marketing_contacts_93a20b6f IS 'Mailchimp audience snapshot — sync cca 1×/24h přes Edge funkci.';
