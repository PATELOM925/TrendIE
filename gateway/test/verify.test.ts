import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { pool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { config } from '../src/config.js';
import { FastifyInstance } from 'fastify';

describe('Verify Endpoint (POST /verify)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await runMigrations();
    await pool.query('TRUNCATE TABLE audit_log, executions, approvals, decisions, inspections, proposals, intents CASCADE');
    app = await buildServer();

    // Seed test intent
    await pool.query(
      `INSERT INTO intents (
        id, owner, seller, product, max_amount, currency, allowed_destinations, expiry, remaining_uses
      ) VALUES (
        'int_verify_01', 'user_1', 'Supplier-A', 'Product-A', 5000, 'USDC',
        '["0xSupplierA"]'::jsonb, NOW() + INTERVAL '1 day', 1
      )`
    );
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('rejects unauthenticated requests to POST /verify with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      payload: {
        proposal: {
          intentId: 'int_verify_01',
          seller: 'supplier-a',
          product: 'product-a',
          amount: '4500',
          currency: 'USDC',
          destination: '0xSupplierA',
          sourceRef: 'listing:abc',
        },
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('approves a valid proposal and issues an Approval handle', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      headers: {
        'x-api-key': config.API_KEY_AGENT,
      },
      payload: {
        proposal: {
          intentId: 'int_verify_01',
          seller: 'supplier-a',
          product: 'product-a',
          amount: '4500',
          currency: 'USDC',
          destination: '0xSupplierA',
          sourceRef: 'listing:abc',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.decision).toBe('approve');
    expect(body.reasonCodes).toEqual(['OK']);
    expect(body.authorizationRef).toBeDefined();
    expect(body.proposalHash).toBeDefined();

    // Verify approval row was created
    const aprRes = await pool.query('SELECT * FROM approvals WHERE id = $1', [body.authorizationRef]);
    expect(aprRes.rows.length).toBe(1);
    expect(aprRes.rows[0].proposal_hash).toBe(body.proposalHash);
    expect(aprRes.rows[0].consumed_at).toBeNull();
  });

  it('returns reject with INTENT_NOT_FOUND when intent does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      headers: {
        'x-api-key': config.API_KEY_AGENT,
      },
      payload: {
        proposal: {
          intentId: 'int_unknown_999',
          seller: 'supplier-a',
          product: 'product-a',
          amount: '4500',
          currency: 'USDC',
          destination: '0xSupplierA',
          sourceRef: 'listing:abc',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.decision).toBe('reject');
    expect(body.reasonCodes).toContain('INTENT_NOT_FOUND');
    expect(body.authorizationRef).toBeNull();
  });

  it('rejects unauthorized seller and does not create an approval', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/verify',
      headers: {
        'x-api-key': config.API_KEY_AGENT,
      },
      payload: {
        proposal: {
          intentId: 'int_verify_01',
          seller: 'evil-supplier',
          product: 'product-a',
          amount: '4500',
          currency: 'USDC',
          destination: '0xSupplierA',
          sourceRef: 'listing:abc',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.decision).toBe('reject');
    expect(body.reasonCodes).toContain('SELLER_MISMATCH');
    expect(body.authorizationRef).toBeNull();
  });
});
