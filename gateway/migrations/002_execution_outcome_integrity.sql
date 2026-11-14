ALTER TABLE approvals ADD COLUMN IF NOT EXISTS consumed_platform VARCHAR(16) CHECK (consumed_platform IN ('goat', 'qatom'));
ALTER TABLE executions ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE executions ALTER COLUMN tx_hash_or_checkout_ref TYPE VARCHAR(512);
ALTER TABLE executions DROP CONSTRAINT IF EXISTS executions_status_check;
ALTER TABLE executions ADD CONSTRAINT executions_status_check CHECK (status IN ('pending_approval', 'submitting', 'pending', 'unknown', 'succeeded', 'failed', 'blocked'));
CREATE OR REPLACE FUNCTION prevent_audit_log_truncate() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: TRUNCATE is strictly forbidden';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_audit_log_truncate ON audit_log;
CREATE TRIGGER trg_prevent_audit_log_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_truncate();
