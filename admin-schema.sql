CREATE TABLE IF NOT EXISTS admin_oauth_flows (
  browser_digest TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  nonce TEXT NOT NULL,
  verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_oauth_flows_expiry ON admin_oauth_flows (expires_at);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_digest TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS admin_oauth_diagnostics (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  stage TEXT NOT NULL,
  observed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS consultation_admin_status (
  consultation_id INTEGER PRIMARY KEY REFERENCES consultations (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled'))
);
