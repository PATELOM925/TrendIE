import { afterEach, describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import { appendAuditLog } from '../src/audit/hashChain.js';
import { pool, withTransaction } from '../src/db/client.js';

const entry = { eventType: 'INTENT_CREATED', entityType: 'intent', entityId: 'test-intent', callerRole: 'dashboard', payload: { owner: 'test-owner' } };

describe('transactional audit writer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('locks the audit chain before reading and inserting on the same transaction', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, row_hash: 'checked-hash' }] });
    const client = { query } as unknown as pg.PoolClient;
    await appendAuditLog(client, entry);
    expect(query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(query.mock.calls[1][0]).toContain('SELECT row_hash');
    expect(query.mock.calls[2][0]).toContain('INSERT INTO audit_log');
  });

  it('does not read or insert when acquiring the chain lock fails', async () => {
    const query = vi.fn().mockRejectedValue(new Error('lock unavailable'));
    await expect(appendAuditLog({ query } as unknown as pg.PoolClient, entry)).rejects.toThrow('lock unavailable');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rolls back the intent transaction if the audit append fails', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    const client = { query, release } as unknown as pg.PoolClient;
    vi.spyOn(pool, 'connect').mockImplementation(async () => client);
    await expect(withTransaction(async (transaction) => {
      await transaction.query('INSERT INTO intents');
      query.mockRejectedValueOnce(new Error('audit unavailable'));
      await appendAuditLog(transaction, entry);
    })).rejects.toThrow('audit unavailable');
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN', 'INSERT INTO intents', "SELECT pg_advisory_xact_lock(hashtext('gateway.audit_log.chain'))", 'ROLLBACK',
    ]);
    expect(release).toHaveBeenCalledOnce();
  });
});
