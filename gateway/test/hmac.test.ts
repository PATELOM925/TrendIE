/**
 * HMAC Verification Tests — Unit + Integration
 *
 * Unit: generateHmacSignature / verifyHmacSignature correctness
 * Integration: tampered hmac_signature in DB is rejected at consume time
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { pool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { config } from '../src/config.js';
import { generateHmacSignature, verifyHmacSignature, type ApprovalPayload } from '../src/approvals/token.js';
import { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Unit tests — no DB required
// ---------------------------------------------------------------------------

describe('generateHmacSignature', () => {
  const payload: ApprovalPayload = {
    approvalId: 'apr_abc123',
    executionId: 'exe_def456',
    proposalHash: 'deadbeef'.repeat(8),
    intentId: 'int_ghi789',
    expiresAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  };

  it('returns a hex string of length 64 (SHA-256)', () => {
    const sig = generateHmacSignature(payload);
    expect(typeof sig).toBe('string');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same value when called twice with identical inputs', () => {
    expect(generateHmacSignature(payload)).toBe(generateHmacSignature(payload));
  });
});

// ---------------------------------------------------------------------------

describe('verifyHmacSignature', () => {
  const payload: ApprovalPayload = {
    approvalId: 'apr_unit01',
    executionId: 'exe_unit01',
    proposalHash: 'cafebabe'.repeat(8),
    intentId: 'int_unit01',
    expiresAt: new Date('2027-06-15T12:00:00.000Z').toISOString(),
  };

  const validSig = generateHmacSignature(payload);

  it('returns true for a valid payload + signature pair', () => {
    expect(verifyHmacSignature(payload, validSig)).toBe(true);
  });

  it('returns false when approvalId is tampered', () => {
    expect(verifyHmacSignature({ ...payload, approvalId: 'apr_TAMPERED' }, validSig)).toBe(false);
  });

  it('returns false when executionId is tampered', () => {
    expect(verifyHmacSignature({ ...payload, executionId: 'exe_TAMPERED' }, validSig)).toBe(false);
  });

  it('returns false when proposalHash is tampered', () => {
    expect(verifyHmacSignature({ ...payload, proposalHash: '00000000'.repeat(8) }, validSig)).toBe(false);
  });

  it('returns false when intentId is tampered', () => {
    expect(verifyHmacSignature({ ...payload, intentId: 'int_TAMPERED' }, validSig)).toBe(false);
  });

  it('returns false when expiresAt is tampered', () => {
    expect(
      verifyHmacSignature({ ...payload, expiresAt: new Date('2099-01-01T00:00:00.000Z').toISOString() }, validSig)
    ).toBe(false);
  });

  it('returns false for a completely wrong signature', () => {
    expect(verifyHmacSignature(payload, '0'.repeat(64))).toBe(false);
  });

  it('returns false for a signature with a different length', () => {
    // Shorter string — length guard path
    expect(verifyHmacSignature(payload, validSig.slice(0, 32))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration test — consume endpoint rejects DB-tampered HMAC
// ---------------------------------------------------------------------------

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
      ['tampered' + '0'.repeat(57), approvalId]  // still 64 chars, but wrong value
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
