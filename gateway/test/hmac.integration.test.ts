/**
 * HMAC Verification Tests — Integration
 *
 * Integration: tampered hmac_signature in DB is rejected at consume time
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { pool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { config } from '../src/config.js';

describe('HMAC integrity at consume endpoint (integration)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await runMigrations();
    await pool.query(
      'TRUNCATE TABLE audit_log, executions, approvals, decisions, inspections, proposals, intents CASCADE'
    );
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  async function seedIntentAndGetApproval() {
    const intentId = `int_hmac_${Math.random().toString(36).substring(7)}`;

    await pool.query(
      `INSERT INTO intents (
        id, owner, seller, product, max_amount, currency, allowed_destinations, expiry, remaining_uses
      ) VALUES ($1, 'user_hmac', 'Supplier-A', 'Product-A', 5000, 'USDC', '["0xSupplierA"]'::jsonb, NOW() + INTERVAL '1 day', 3)`,
      [intentId]
    );

    const proposal = {
      intentId,
      seller: 'supplier-a',
      product: 'product-a',
      amount: '4000',
      currency: 'USDC',
      destination: '0xSupplierA',
      sourceRef: 'listing:hmac-test',
    };

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/verify',
      headers: { 'x-api-key': config.API_KEY_AGENT },
      payload: { proposal },
    });

    expect(verifyRes.statusCode).toBe(200);
    const body = verifyRes.json();
    expect(body.decision).toBe('approve');
    expect(body.authorizationRef).toBeDefined();

    return { intentId, approvalId: body.authorizationRef as string, proposal };
  }

  it('consumes successfully when HMAC is intact', async () => {
    const { approvalId, proposal } = await seedIntentAndGetApproval();

    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${approvalId}/consume`,
      headers: { 'x-api-key': config.API_KEY_ADAPTER_GOAT },
      payload: proposal,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().executionId).toBeDefined();
  });

  it('returns 403 with HMAC_INVALID when hmac_signature is tampered in the DB', async () => {
    const { approvalId, proposal } = await seedIntentAndGetApproval();

    // Directly overwrite the HMAC signature in the DB to simulate a tampered record
    await pool.query(
      `UPDATE approvals SET hmac_signature = $1 WHERE id = $2`,
      ['tampered' + '0'.repeat(57), approvalId] // still 64 chars, but wrong value
    );

    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${approvalId}/consume`,
      headers: { 'x-api-key': config.API_KEY_ADAPTER_GOAT },
      payload: proposal,
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    // The route returns FORBIDDEN with the reason embedded in the message
    expect(body.error).toBe('FORBIDDEN');
    expect(body.message).toContain('HMAC_INVALID');
  });

  it('returns 403 with HMAC_INVALID when hmac_signature is replaced with all-zeros', async () => {
    const { approvalId, proposal } = await seedIntentAndGetApproval();

    await pool.query(
      `UPDATE approvals SET hmac_signature = $1 WHERE id = $2`,
      ['0'.repeat(64), approvalId]
    );

    const res = await app.inject({
      method: 'POST',
      url: `/approvals/${approvalId}/consume`,
      headers: { 'x-api-key': config.API_KEY_ADAPTER_QATOM },
      payload: proposal,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().message).toContain('HMAC_INVALID');
  });
});
