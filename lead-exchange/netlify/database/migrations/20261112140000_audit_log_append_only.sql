-- Database-enforced append-only protection for audit_log.
--
-- Application code only ever INSERTs into audit_log (every route and the public intake routes were
-- checked) and SELECTs from it for the application detail page. This migration makes UPDATE,
-- DELETE and TRUNCATE fail at the database, so historical commercial decisions cannot be rewritten
-- through the app, a bug, or an injected query running with the app's credentials.
--
-- INSERT and SELECT are unaffected. The table has no foreign keys and nothing cascades into it.
--
-- Privileged maintenance exception (documented in docs/ONBOARDING_CALL_ROLLBACK.md): a database
-- owner or superuser who genuinely must amend the log (for example a legal erasure request) can
-- do so deliberately and visibly, inside a transaction:
--   BEGIN;
--   ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_no_update_delete;
--   ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_no_truncate;
--   -- ...the maintenance statement...
--   ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_no_update_delete;
--   ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_no_truncate;
--   COMMIT;
-- Roll back with: DROP TRIGGER trg_audit_log_no_update_delete ON audit_log;
--                 DROP TRIGGER trg_audit_log_no_truncate ON audit_log;
--                 DROP FUNCTION audit_log_reject_change();

CREATE OR REPLACE FUNCTION audit_log_reject_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_reject_change();

CREATE TRIGGER trg_audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_reject_change();
