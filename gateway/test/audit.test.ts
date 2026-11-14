import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { pool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { config } from '../src/config.js';
import { verifyAuditChain } from '../src/audit/verifyChain.js';
import { FastifyInstance } from 'fastify';

describe('Audit, Decision, and Human Review Resolution (Step 9)', () => {
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

  it('verifies valid cryptographic hash chain across multiple audit events', async () => {
    // 1. Create an intent
    const intentRes = await app.inject({
      method: 'POST',
      url: '/intents',
      headers: { 'x-api-key': config.API_KEY_DASHBOARD },
      payload: {
        id: 'int_audit_01',
        owner: 'user_1',
        seller: 'Supplier-A',
        product: 'Product-A',
        maxAmount: '5000',
        currency: 'USDC',
        allowedDestinations: ['0xSupplierA'],
        expiry: '2026-12-01T00:00:00Z',
        remainingUses: 1,
        createdAt: '2026-11-14T10:00:00Z',
      },
    });
    expect(intentRes.statusCode).toBe(201);

    // 2. Verify audit chain integrity
    const chainVerification = await verifyAuditChain(pool);
    expect(chainVerification.valid).toBe(true);
    expect(chainVerification.totalEntries).toBeGreaterThan(0);
  });

  it('provides GET /audit?intentId= and GET /decisions/:id', async () => {
    const proposal = {
      intentId: 'int_audit_01',
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
    const decision = verifyRes.json();

    // Query GET /decisions/:id
    const decRes = await app.inject({
      method: 'GET',
      url: `/decisions/${decision.id}`,
      headers: { 'x-api-key': config.API_KEY_DASHBOARD },
    });
    expect(decRes.statusCode).toBe(200);
    const decBody = decRes.json();
    expect(decBody.id).toBe(decision.id);
    expect(decBody.proposalHash).toBe(decision.proposalHash);

    // Query GET /audit?intentId=
    const auditRes = await app.inject({
      method: 'GET',
      url: '/audit?intentId=int_audit_01',
      headers: { 'x-api-key': config.API_KEY_DASHBOARD },
    });
    expect(auditRes.statusCode).toBe(200);
    const auditRows = auditRes.json();
    expect(Array.isArray(auditRows)).toBe(true);
    expect(auditRows.length).toBeGreaterThan(0);
  });

  it('human review resolution: POST /reviews/:decisionId/resolve converts review -> approve', async () => {
    // Propose an ambiguous/medium flag item to produce a 'review' decision
    const proposal = {
      intentId: 'int_audit_01',
      seller: 'supplier-a',
      product: 'product-a',
      amount: '4500',
      currency: 'USDC',
      destination: '0xSupplierA',
      sourceRef: 'listing:abc',
    };

    const inspection = {
      source: 'listing:abc',
      flags: [{ code: 'SUSPICIOUS_TEXT', severity: 'medium' as const }],
      evidence: ['Needs human confirmation'],
      findings: {},
    };

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/verify',
      headers: { 'x-api-key': config.API_KEY_AGENT },
      payload: { proposal, inspection },
    });
    const decision = verifyRes.json();
    expect(decision.decision).toBe('review');
    expect(decision.authorizationRef).toBeNull();

    // Resolve review -> approve
    const resolveRes = await app.inject({
      method: 'POST',
      url: `/reviews/${decision.id}/resolve`,
      headers: { 'x-api-key': config.API_KEY_ADMIN },
      payload: {
        resolution: 'approve',
        notes: 'Verified manually by human officer',
      },
    });

    expect(resolveRes.statusCode).toBe(200);
    const resolveBody = resolveRes.json();
    expect(resolveBody.decision).toBe('approve');
    expect(resolveBody.authorizationRef).toBeDefined();

    // Verify approval row was created
    const aprRes = await pool.query('SELECT * FROM approvals WHERE id = $1', [resolveBody.authorizationRef]);
    expect(aprRes.rows.length).toBe(1);
  });

  it('cannot override a hard reject via review resolution', async () => {
    // Propose an unauthorized seller
    const proposal = {
      intentId: 'int_audit_01',
      seller: 'attacker-seller',
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
    const decision = verifyRes.json();
    expect(decision.decision).toBe('reject');

    // Attempt resolve on a hard reject -> 400 Bad Request
    const resolveRes = await app.inject({
      method: 'POST',
      url: `/reviews/${decision.id}/resolve`,
      headers: { 'x-api-key': config.API_KEY_ADMIN },
      payload: {
        resolution: 'approve',
        notes: 'Attempting to override hard reject',
      },
    });
    expect(resolveRes.statusCode).toBe(400);
  });
});
