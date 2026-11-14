import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { pool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { config } from '../src/config.js';
import { FastifyInstance } from 'fastify';

describe('Atomic Approval Consumption (POST /approvals/:id/consume)', () => {
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

  async function setupIntentAndApproval(remainingUses = 1, expiryInterval = '1 day') {
    const intentId = `int_consume_${Math.random().toString(36).substring(7)}`;
    await pool.query(
      `INSERT INTO intents (
        id, owner, seller, product, max_amount, currency, allowed_destinations, expiry, remaining_uses
      ) VALUES ($1, 'user_1', 'Supplier-A', 'Product-A', 5000, 'USDC', '["0xSupplierA"]'::jsonb, NOW() + INTERVAL '${expiryInterval}', $2)`,
      [intentId, remainingUses]
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
    return {
      intentId,
      approvalId: verifyBody.authorizationRef as string,
      proposal,
    };
  }

  it('rejects calls from agent role with 403 (adapter roles only)', async () => {
    const { approvalId, proposal } = await setupIntentAndApproval();
    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${approvalId}/consume`,
      headers: { 'x-api-key': config.API_KEY_AGENT },
      payload: proposal,
    });
    expect(res.statusCode).toBe(403);
  });

  it('successfully consumes valid approval by adapter role and decrements remainingUses', async () => {
    const { intentId, approvalId, proposal } = await setupIntentAndApproval(1);
    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${approvalId}/consume`,
      headers: { 'x-api-key': config.API_KEY_ADAPTER_GOAT },
      payload: proposal,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.executionId).toBeDefined();

    // Verify DB state
    const aprRes = await pool.query('SELECT * FROM approvals WHERE id = $1', [approvalId]);
    expect(aprRes.rows[0].consumed_at).not.toBeNull();

    const intentRes = await pool.query('SELECT remaining_uses FROM intents WHERE id = $1', [intentId]);
    expect(intentRes.rows[0].remaining_uses).toBe(0);
  });

  it('double consume fails: second consume receives 403', async () => {
    const { approvalId, proposal } = await setupIntentAndApproval(2);
    // First consume
    const res1 = await app.inject({
      method: 'POST',
      url: `/approvals/${approvalId}/consume`,
      headers: { 'x-api-key': config.API_KEY_ADAPTER_GOAT },
      payload: proposal,
    });
    expect(res1.statusCode).toBe(200);

    // Second consume
    const res2 = await app.inject({
      method: 'POST',
      url: `/approvals/${approvalId}/consume`,
      headers: { 'x-api-key': config.API_KEY_ADAPTER_GOAT },
      payload: proposal,
    });
    expect(res2.statusCode).toBe(403);
  });

  it('rejects tampered proposal payload at consume time with 403', async () => {
    const { approvalId, proposal } = await setupIntentAndApproval();
    const tamperedProposal = {
      ...proposal,
      amount: '4501', // altered by 1 minor unit
    };

    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${approvalId}/consume`,
      headers: { 'x-api-key': config.API_KEY_ADAPTER_QATOM },
      payload: tamperedProposal,
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects tampered destination at consume time with 403', async () => {
    const { approvalId, proposal } = await setupIntentAndApproval();
    const tamperedProposal = {
      ...proposal,
      destination: '0xAttacker',
    };

    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${approvalId}/consume`,
      headers: { 'x-api-key': config.API_KEY_ADAPTER_QATOM },
      payload: tamperedProposal,
    });
    expect(res.statusCode).toBe(403);
  });

  it('concurrency test: 20 parallel consume requests -> exactly 1 succeeds and 19 fail', async () => {
    const { approvalId, proposal } = await setupIntentAndApproval(1);

    const promises = Array.from({ length: 20 }, () =>
      app.inject({
        method: 'POST',
        url: `/approvals/${approvalId}/consume`,
        headers: { 'x-api-key': config.API_KEY_ADAPTER_GOAT },
        payload: proposal,
      })
    );

    const responses = await Promise.all(promises);
    const successes = responses.filter((r) => r.statusCode === 200);
    const forbidden = responses.filter((r) => r.statusCode === 403);

    expect(successes.length).toBe(1);
    expect(forbidden.length).toBe(19);
  });
});
