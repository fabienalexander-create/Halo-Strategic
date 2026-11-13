-- Per-admin session version. Every admin session cookie carries the version that was current when
-- it was issued; requireAdmin compares it with this column on every request (it already loads
-- the admin row), so bumping the number instantly invalidates every cookie issued before it.
--
-- The version is bumped by the application on logout, and by this trigger whenever an admin's
-- role or password hash changes (demotion, promotion, password reset), however the change is made,
-- including by hand in the database. Other updates (for example last_login_at) do not bump it.
--
-- Cookies issued before this migration carry no version and are rejected, so every admin signs in
-- once after release.
--
-- Rollback (independent of the other migrations; run only with approval):
--   DROP TRIGGER IF EXISTS trg_admin_users_bump_session_version ON admin_users;
--   DROP FUNCTION IF EXISTS admin_users_bump_session_version();
--   ALTER TABLE admin_users DROP COLUMN IF EXISTS session_version;
-- The previous application build ignores the column, so rolling back the app first is also safe.

ALTER TABLE admin_users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION admin_users_bump_session_version() RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.session_version := OLD.session_version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_users_bump_session_version
  BEFORE UPDATE OF role, password_hash ON admin_users
  FOR EACH ROW EXECUTE FUNCTION admin_users_bump_session_version();
