-- Migration 003: Shared binding, authority, and owner-scoped history

-- Add binding fields to intents
ALTER TABLE intents ADD COLUMN IF NOT EXISTS intent_version INT NOT NULL DEFAULT 1;
ALTER TABLE intents ADD COLUMN IF NOT EXISTS platform VARCHAR(32);
ALTER TABLE intents ADD COLUMN IF NOT EXISTS chain VARCHAR(64);
ALTER TABLE intents ADD COLUMN IF NOT EXISTS asset VARCHAR(32);
ALTER TABLE intents ADD COLUMN IF NOT EXISTS scale INT DEFAULT 0;
ALTER TABLE intents ADD COLUMN IF NOT EXISTS sender VARCHAR(256);
CREATE INDEX IF NOT EXISTS idx_intents_owner ON intents(owner);

-- Add binding fields to approvals
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS owner_id VARCHAR(128);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS intent_version INT DEFAULT 1;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS bound_platform VARCHAR(16) CHECK (bound_platform IN ('goat', 'qatom'));
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS bound_asset VARCHAR(32);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS bound_chain VARCHAR(64);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS bound_scale INT DEFAULT 0;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS bound_sender VARCHAR(256);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS bound_destination VARCHAR(256);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS spend_authorization_id VARCHAR(128);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS spend_ceiling NUMERIC(38, 0);
CREATE INDEX IF NOT EXISTS idx_approvals_owner_id ON approvals(owner_id);

-- Add checkpoint and owner fields to executions
ALTER TABLE executions ADD COLUMN IF NOT EXISTS checkpoint_phase VARCHAR(32) CHECK (checkpoint_phase IN ('signed', 'broadcast'));
ALTER TABLE executions ADD COLUMN IF NOT EXISTS checkpoint_tx_hash VARCHAR(512);
ALTER TABLE executions ADD COLUMN IF NOT EXISTS owner_id VARCHAR(128);
CREATE INDEX IF NOT EXISTS idx_executions_owner_id ON executions(owner_id);
