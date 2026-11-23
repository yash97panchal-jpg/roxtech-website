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

CREATE TABLE IF NOT EXISTS admin_passkeys (
  credential_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL CHECK (counter >= 0),
  approval_reference TEXT NOT NULL UNIQUE,
  pending_until INTEGER NOT NULL,
  approved_at INTEGER,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS admin_passkeys_approval ON admin_passkeys (email, approved_at);

CREATE TABLE IF NOT EXISTS admin_passkey_challenges (
  session_digest TEXT NOT NULL REFERENCES admin_sessions (token_digest) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('register', 'authenticate')),
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (session_digest, operation)
);

CREATE TABLE IF NOT EXISTS admin_passkey_verifications (
  session_digest TEXT PRIMARY KEY REFERENCES admin_sessions (token_digest) ON DELETE CASCADE,
  credential_id TEXT NOT NULL REFERENCES admin_passkeys (credential_id)
);
