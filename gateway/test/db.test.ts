import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, withTransaction } from '../src/db/client.js';
import { appendAuditLog, computeRowHash, GENESIS_HASH } from '../src/audit/hashChain.js';
import { runMigrations } from '../src/db/migrate.js';

describe('Database & Audit Log Security', () => {
  beforeAll(async () => {
    await runMigrations();
    // Clean test audit log
    await pool.query('TRUNCATE TABLE audit_log, executions, approvals, decisions, inspections, proposals, intents CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('inserts and chains audit log rows with correct SHA-256 prev_hash', async () => {
    const entry1 = await withTransaction((client) => appendAuditLog(client, {
      eventType: 'INTENT_CREATED',
      entityType: 'intent',
      entityId: 'int_01',
      callerRole: 'dashboard',
      payload: { maxAmount: '5000' },
    }));

    const res1 = await pool.query('SELECT * FROM audit_log WHERE id = $1', [entry1.id]);
    expect(res1.rows[0].prev_hash).toBe(GENESIS_HASH);
    expect(res1.rows[0].row_hash).toBe(entry1.rowHash);

    // Verify computed hash matches formula
    const recalculated = computeRowHash(
      GENESIS_HASH,
      'INTENT_CREATED',
      'intent',
      'int_01',
      'dashboard',
      { maxAmount: '5000' },
      res1.rows[0].created_at.toISOString()
    );
    expect(res1.rows[0].row_hash).toBe(recalculated);

    const entry2 = await withTransaction((client) => appendAuditLog(client, {
      eventType: 'PROPOSAL_VERIFIED',
      entityType: 'proposal',
      entityId: 'prop_01',
      callerRole: 'agent',
      payload: { decision: 'approve' },
    }));

    const res2 = await pool.query('SELECT * FROM audit_log WHERE id = $1', [entry2.id]);
    expect(res2.rows[0].prev_hash).toBe(entry1.rowHash);
    expect(res2.rows[0].row_hash).toBe(entry2.rowHash);
  });

  it('strictly blocks UPDATE on audit_log via trigger (append-only)', async () => {
    const existing = await pool.query('SELECT id FROM audit_log LIMIT 1');
    const id = existing.rows[0].id;
    await expect(
      pool.query(`UPDATE audit_log SET caller_role = 'attacker' WHERE id = ${id}`)
    ).rejects.toThrow(/audit_log is append-only/);
  });

  it('strictly blocks DELETE on audit_log via trigger (append-only)', async () => {
    const existing = await pool.query('SELECT id FROM audit_log LIMIT 1');
    const id = existing.rows[0].id;
    await expect(
      pool.query(`DELETE FROM audit_log WHERE id = ${id}`)
    ).rejects.toThrow(/audit_log is append-only/);
  });

  it('supports explicit transactional rollback without committing partial state', async () => {
    try {
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO intents (
            id, owner, seller, product, max_amount, currency, allowed_destinations, expiry, remaining_uses
          ) VALUES ('int_fail', 'u1', 's1', 'p1', 100, 'USDC', '["0x1"]'::jsonb, NOW() + INTERVAL '1 day', 1)`
        );
        throw new Error('Simulated failure');
      });
    } catch {
      // expected
    }

    const check = await pool.query("SELECT * FROM intents WHERE id = 'int_fail'");
    expect(check.rows.length).toBe(0);
  });
});
