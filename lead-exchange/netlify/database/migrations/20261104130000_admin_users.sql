-- Admin authentication (Priority 1). No public registration — accounts are created only via the
-- one-time bootstrap endpoint (guarded by ADMIN_SETUP_TOKEN) or, later, by an existing owner-role
-- admin. Role-based from day one, even with a single admin, so Priority 2+ can add a lower-privilege
-- "reviewer" role without a schema change.

CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'reviewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
