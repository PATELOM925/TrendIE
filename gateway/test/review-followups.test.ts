import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildServer } from '../src/server.js';
import { config } from '../src/config.js';
import { pool } from '../src/db/client.js';
import { generateHmacSignature, verifyHmacSignature } from '../src/approvals/token.js';

const proposal = { intentId: 'test-intent', seller: 'test-seller', product: 'test-product', amount: '1', currency: 'USDC', destination: 'test-destination', sourceRef: 'fixture://test' };

describe('adversarial review follow-ups (offline)', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['constructor', 'toString', '__proto__', 'unknown-key'])('treats %s as an unknown API key', async (key) => {
    const query = vi.spyOn(pool, 'query');
    const app = await buildServer();
    try {
      const response = await app.inject({ method: 'GET', url: '/intents', headers: { 'x-api-key': key } });
      expect(response.statusCode).toBe(401);
      expect(query).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('rejects oversized proposal fields before database access', async () => {
    const connect = vi.spyOn(pool, 'connect');
    const app = await buildServer();
    try {
      const response = await app.inject({ method: 'POST', url: '/verify', headers: { 'x-api-key': config.API_KEY_AGENT }, payload: { proposal: { ...proposal, seller: 's'.repeat(300) } } });
      expect(response.statusCode).toBe(400);
      expect(connect).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it.each([
    { url: '/verify', key: config.API_KEY_AGENT, payload: { proposal } },
    { url: '/reviews/test-decision/resolve', key: config.API_KEY_ADMIN, payload: { resolution: 'approve', notes: 'synthetic review' } },
  ])('sanitizes unexpected database errors from $url', async ({ url, key, payload }) => {
    vi.spyOn(pool, 'connect').mockRejectedValue(Object.assign(new Error('value too long for type character varying(256)'), { code: '22001' }));
    const app = await buildServer();
    try {
      const response = await app.inject({ method: 'POST', url, headers: { 'x-api-key': key }, payload });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: 'INTERNAL_ERROR', message: 'Request could not be completed' });
      expect(response.body).not.toContain('22001');
      expect(response.body).not.toContain('character varying');
    } finally { await app.close(); }
  });

  it.each(['limit=-1', 'offset=-1', 'limit=NaN', 'limit=101', 'offset=1x'])('rejects malformed intent pagination: %s', async (queryString) => {
    const query = vi.spyOn(pool, 'query');
    const app = await buildServer();
    try {
      const response = await app.inject({ method: 'GET', url: `/intents?${queryString}`, headers: { 'x-api-key': config.API_KEY_DASHBOARD } });
      expect(response.statusCode).toBe(400);
      expect(query).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('checks stored approval HMAC integrity and rejects malformed signatures', () => {
    const payload = { approvalId: 'test-approval', executionId: 'test-execution', proposalHash: 'a'.repeat(64), intentId: 'test-intent', expiresAt: '2026-12-01T00:00:00.000Z' };
    const signature = generateHmacSignature(payload);
    expect(verifyHmacSignature(payload, signature)).toBe(true);
    expect(verifyHmacSignature({ ...payload, executionId: 'another-execution' }, signature)).toBe(false);
    expect(verifyHmacSignature(payload, 'é'.repeat(64))).toBe(false);
    expect(verifyHmacSignature(payload, 'invalid')).toBe(false);
  });
});
