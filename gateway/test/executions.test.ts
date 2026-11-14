import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { pool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { config } from '../src/config.js';
import { FastifyInstance } from 'fastify';

describe('Execution Results Endpoint (POST /executions/:id/result)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await runMigrations();
    await pool.query('TRUNCATE TABLE audit_log, executions, approvals, decisions, inspections, proposals, intents CASCADE');
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  async function setupExecution() {
    const intentId = `int_exe_${Math.random().toString(36).substring(7)}`;
    await pool.query(
      `INSERT INTO intents (
        id, owner, seller, product, max_amount, currency, allowed_destinations, expiry, remaining_uses
      ) VALUES ($1, 'user_1', 'Supplier-A', 'Product-A', 5000, 'USDC', '["0xSupplierA"]'::jsonb, NOW() + INTERVAL '1 day', 1)`,
      [intentId]
    );

    const proposal = {
      intentId,
      seller: 'supplier-a',
      product: 'product-a',
      amount: '4500',
      currency: 'USDC',
      destination: '0xSupplierA',
      sourceRef: 'listing:abc',
    };

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/verify',
      headers: { 'x-api-key': config.API_KEY_AGENT },
      payload: { proposal },
    });
    const verifyBody = verifyRes.json();
    const approvalId = verifyBody.authorizationRef;

    const consumeRes = await app.inject({
      method: 'POST',
      url: `/approvals/${approvalId}/consume`,
      headers: { 'x-api-key': config.API_KEY_ADAPTER_GOAT },
      payload: proposal,
    });
    const { executionId } = consumeRes.json();
    return { executionId, approvalId };
  }

  it('rejects POST /executions/:id/result from agent role with 403', async () => {
    const { executionId } = await setupExecution();
    const res = await app.inject({
      method: 'POST',
      url: `/executions/${executionId}/result`,
      headers: { 'x-api-key': config.API_KEY_AGENT },
      payload: {
        executionId,
        status: 'succeeded',
        platform: 'goat',
        txHashOrCheckoutRef: '0x123',
        error: null,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('records execution result and is idempotent on repeated POST', async () => {
    const { executionId } = await setupExecution();
    const payload = {
      executionId,
      status: 'succeeded' as const,
      platform: 'goat' as const,
      txHashOrCheckoutRef: '0x123456789abcdef',
      error: null,
    };

    // First POST
    const res1 = await app.inject({
      method: 'POST',
      url: `/executions/${executionId}/result`,
      headers: { 'x-api-key': config.API_KEY_ADAPTER_GOAT },
      payload,
    });
    expect(res1.statusCode).toBe(200);
    const body1 = res1.json();
    expect(body1.status).toBe('succeeded');

    // Repeated POST with identical payload (idempotent)
    const res2 = await app.inject({
      method: 'POST',
      url: `/executions/${executionId}/result`,
      headers: { 'x-api-key': config.API_KEY_ADAPTER_GOAT },
      payload,
    });
    expect(res2.statusCode).toBe(200);
    const body2 = res2.json();
    expect(body2).toEqual(body1);

    // Verify only 1 row exists in executions table
    const dbCount = await pool.query('SELECT count(*) FROM executions WHERE execution_id = $1', [executionId]);
    expect(parseInt(dbCount.rows[0].count, 10)).toBe(1);
  });

  it('records pending_unknown timeout status without reissuing approval', async () => {
    const { executionId, approvalId } = await setupExecution();
    const payload = {
      executionId,
      status: 'pending_unknown' as const,
      platform: 'qatom' as const,
      txHashOrCheckoutRef: null,
      error: 'Network timeout during checkout',
    };

    const res = await app.inject({
      method: 'POST',
      url: `/executions/${executionId}/result`,
      headers: { 'x-api-key': config.API_KEY_ADAPTER_QATOM },
      payload,
    });
    expect(res.statusCode).toBe(200);

    // Confirm approval remains consumed
    const aprRes = await pool.query('SELECT consumed_at FROM approvals WHERE id = $1', [approvalId]);
    expect(aprRes.rows[0].consumed_at).not.toBeNull();
  });
});
