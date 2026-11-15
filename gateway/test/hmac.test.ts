/**
 * HMAC Verification Tests — Unit
 *
 * Unit: generateHmacSignature / verifyHmacSignature correctness
 */
import { describe, it, expect } from 'vitest';
import { generateHmacSignature, verifyHmacSignature, type ApprovalPayload } from '../src/approvals/token.js';

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
