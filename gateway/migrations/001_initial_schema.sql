-- Migrations: 001_initial_schema.sql

-- Intents table: stores trusted authorizations
CREATE TABLE IF NOT EXISTS intents (
    id VARCHAR(64) PRIMARY KEY,
    owner VARCHAR(128) NOT NULL,
    seller VARCHAR(256) NOT NULL,
    product VARCHAR(256) NOT NULL,
    max_amount NUMERIC(38, 0) NOT NULL,
    currency VARCHAR(16) NOT NULL,
    allowed_destinations JSONB NOT NULL,
    expiry TIMESTAMPTZ NOT NULL,
    remaining_uses INT NOT NULL CHECK (remaining_uses >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Proposals table: stores agent proposed transactions
CREATE TABLE IF NOT EXISTS proposals (
    id VARCHAR(64) PRIMARY KEY,
    intent_id VARCHAR(64) REFERENCES intents(id),
    proposal_hash VARCHAR(64) NOT NULL,
    seller VARCHAR(256) NOT NULL,
    product VARCHAR(256) NOT NULL,
    amount NUMERIC(38, 0) NOT NULL,
    currency VARCHAR(16) NOT NULL,
    destination VARCHAR(256) NOT NULL,
    source_ref VARCHAR(256) NOT NULL,
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proposals_hash ON proposals(proposal_hash);

-- Inspections table: stores advisory inspection results (Person 4)
CREATE TABLE IF NOT EXISTS inspections (
    id VARCHAR(64) PRIMARY KEY,
    proposal_id VARCHAR(64) REFERENCES proposals(id),
    source VARCHAR(256) NOT NULL,
    flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    findings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Decisions table: stores policy verification decisions
CREATE TABLE IF NOT EXISTS decisions (
    id VARCHAR(64) PRIMARY KEY,
    proposal_id VARCHAR(64) REFERENCES proposals(id),
    proposal_hash VARCHAR(64) NOT NULL,
    decision VARCHAR(16) NOT NULL CHECK (decision IN ('approve', 'reject', 'review')),
    reason_codes JSONB NOT NULL,
    authorization_ref VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_decisions_hash ON decisions(proposal_hash);

-- Approvals table: single-use, transaction-bound approval tokens
CREATE TABLE IF NOT EXISTS approvals (
    id VARCHAR(64) PRIMARY KEY,
    decision_id VARCHAR(64) REFERENCES decisions(id),
    intent_id VARCHAR(64) REFERENCES intents(id),
    proposal_hash VARCHAR(64) NOT NULL,
    execution_id VARCHAR(64) NOT NULL UNIQUE,
    hmac_signature VARCHAR(128) NOT NULL,
    key_id VARCHAR(32) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approvals_proposal_hash ON approvals(proposal_hash);
CREATE INDEX IF NOT EXISTS idx_approvals_consumed_at ON approvals(consumed_at);

-- Executions table: records payment results from adapters
CREATE TABLE IF NOT EXISTS executions (
    id VARCHAR(64) PRIMARY KEY,
    execution_id VARCHAR(64) NOT NULL UNIQUE,
    approval_id VARCHAR(64) REFERENCES approvals(id),
    status VARCHAR(32) NOT NULL CHECK (status IN ('succeeded', 'failed', 'pending_unknown')),
    platform VARCHAR(32) NOT NULL CHECK (platform IN ('goat', 'qatom')),
    tx_hash_or_checkout_ref VARCHAR(256),
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log: append-only table with cryptographic hash chain
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    caller_role VARCHAR(32) NOT NULL,
    payload JSONB NOT NULL,
    prev_hash VARCHAR(64) NOT NULL,
    row_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Enforce append-only on audit_log via trigger in case table privileges allow it
CREATE OR REPLACE FUNCTION prevent_audit_log_tamper()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only: UPDATE and DELETE are strictly forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_tamper ON audit_log;
CREATE TRIGGER trg_prevent_audit_log_tamper
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_tamper();
