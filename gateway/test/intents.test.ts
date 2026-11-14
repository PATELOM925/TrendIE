import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { pool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { config } from '../src/config.js';
import { FastifyInstance } from 'fastify';

describe('Auth Plugin & Intent Routes', () => {
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

  const validIntentPayload = {
    id: 'int_auth_01',
    owner: 'user_123',
    seller: 'Supplier-A',
    product: 'Product-A',
    maxAmount: '5000',
    currency: 'USDC',
    allowedDestinations: ['0xSupplierA'],
    expiry: '2026-12-01T00:00:00Z',
    remainingUses: 1,
    createdAt: '2026-11-14T10:00:00Z',
  };

  it('rejects unauthenticated requests to POST /intents with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/intents',
      payload: validIntentPayload,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects POST /intents from agent role with 403 (intent write is user/dashboard only)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/intents',
      headers: {
        'x-api-key': config.API_KEY_AGENT,
      },
      payload: validIntentPayload,
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows POST /intents from dashboard role and stores immutable intent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/intents',
      headers: {
        'x-api-key': config.API_KEY_DASHBOARD,
      },
      payload: validIntentPayload,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBe(validIntentPayload.id);

    // Verify GET /intents/:id
    const getRes = await app.inject({
      method: 'GET',
      url: `/intents/${validIntentPayload.id}`,
      headers: {
        'x-api-key': config.API_KEY_DASHBOARD,
      },
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json();
    expect(getBody.id).toBe(validIntentPayload.id);
    expect(getBody.seller).toBe(validIntentPayload.seller);
  });

  it('returns 404 for non-existent intent', async () => {
    const getRes = await app.inject({
      method: 'GET',
      url: '/intents/int_nonexistent',
      headers: {
        'x-api-key': config.API_KEY_DASHBOARD,
      },
    });
    expect(getRes.statusCode).toBe(404);
  });
});
