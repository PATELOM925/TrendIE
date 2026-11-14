import { describe, it, expect } from 'vitest';
import { Intent, PurchaseProposal, InspectionResult } from '../src/schemas/index.js';
import { verifyPolicy } from '../src/policy/verify.js';

describe('Deterministic Policy Engine (verify)', () => {
  const baseIntent: Intent = {
    id: 'int_01H',
    owner: 'user_123',
    seller: 'supplier-a',
    product: 'product-a',
    maxAmount: '5000',
    currency: 'USDC',
    allowedDestinations: ['0xSupplierA'],
    expiry: '2026-12-01T00:00:00.000Z',
    remainingUses: 1,
    createdAt: '2026-11-14T10:00:00.000Z',
  };

  const baseProposal: PurchaseProposal = {
    intentId: 'int_01H',
    seller: 'supplier-a',
    product: 'product-a',
    amount: '4500',
    currency: 'USDC',
    destination: '0xSupplierA',
    sourceRef: 'listing:abc',
  };

  const fixedNow = new Date('2026-11-14T12:00:00.000Z');

  it('approves when all fields match exactly and within constraints', () => {
    const res = verifyPolicy(baseIntent, baseProposal, undefined, fixedNow);
    expect(res.decision).toBe('approve');
    expect(res.reasonCodes).toEqual(['OK']);
  });

  it('rejects when intent is null (INTENT_NOT_FOUND)', () => {
    const res = verifyPolicy(null, baseProposal, undefined, fixedNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('INTENT_NOT_FOUND');
  });

  it('rejects when intent is expired (INTENT_EXPIRED)', () => {
    const expiredNow = new Date('2026-12-01T00:00:00.001Z');
    const res = verifyPolicy(baseIntent, baseProposal, undefined, expiredNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('INTENT_EXPIRED');
  });

  it('rejects at exact boundary of expiry (now == expiry)', () => {
    const boundaryNow = new Date('2026-12-01T00:00:00.000Z');
    const res = verifyPolicy(baseIntent, baseProposal, undefined, boundaryNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('INTENT_EXPIRED');
  });

  it('rejects when remaining uses is 0 (INTENT_EXHAUSTED)', () => {
    const exhaustedIntent: Intent = { ...baseIntent, remainingUses: 0 };
    const res = verifyPolicy(exhaustedIntent, baseProposal, undefined, fixedNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('INTENT_EXHAUSTED');
  });

  it('rejects when seller does not match exactly (SELLER_MISMATCH)', () => {
    const mismatchProposal: PurchaseProposal = { ...baseProposal, seller: 'supplier-b' };
    const res = verifyPolicy(baseIntent, mismatchProposal, undefined, fixedNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('SELLER_MISMATCH');
  });

  it('rejects when product does not match exactly (PRODUCT_MISMATCH)', () => {
    const mismatchProposal: PurchaseProposal = { ...baseProposal, product: 'product-b' };
    const res = verifyPolicy(baseIntent, mismatchProposal, undefined, fixedNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('PRODUCT_MISMATCH');
  });

  it('approves when amount equals maxAmount boundary (amount == maxAmount)', () => {
    const exactMaxProposal: PurchaseProposal = { ...baseProposal, amount: '5000' };
    const res = verifyPolicy(baseIntent, exactMaxProposal, undefined, fixedNow);
    expect(res.decision).toBe('approve');
    expect(res.reasonCodes).toEqual(['OK']);
  });

  it('rejects when amount exceeds maxAmount by 1 minor unit (AMOUNT_EXCEEDS_MAX)', () => {
    const overMaxProposal: PurchaseProposal = { ...baseProposal, amount: '5001' };
    const res = verifyPolicy(baseIntent, overMaxProposal, undefined, fixedNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('AMOUNT_EXCEEDS_MAX');
  });

  it('rejects when amount is 0 (AMOUNT_INVALID)', () => {
    const zeroAmountProposal: PurchaseProposal = { ...baseProposal, amount: '0' };
    const res = verifyPolicy(baseIntent, zeroAmountProposal, undefined, fixedNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('AMOUNT_INVALID');
  });

  it('rejects when currency mismatches (CURRENCY_MISMATCH)', () => {
    const currencyMismatch: PurchaseProposal = { ...baseProposal, currency: 'ETH' };
    const res = verifyPolicy(baseIntent, currencyMismatch, undefined, fixedNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('CURRENCY_MISMATCH');
  });

  it('rejects when destination is not in allowedDestinations (DESTINATION_NOT_ALLOWED)', () => {
    const badDest: PurchaseProposal = { ...baseProposal, destination: '0xAttacker' };
    const res = verifyPolicy(baseIntent, badDest, undefined, fixedNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('DESTINATION_NOT_ALLOWED');
  });

  it('returns ALL applicable reason codes for multiple violations', () => {
    const multiViolationProposal: PurchaseProposal = {
      ...baseProposal,
      seller: 'supplier-attacker',
      amount: '9999999',
      destination: '0xAttacker',
    };
    const res = verifyPolicy(baseIntent, multiViolationProposal, undefined, fixedNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('SELLER_MISMATCH');
    expect(res.reasonCodes).toContain('AMOUNT_EXCEEDS_MAX');
    expect(res.reasonCodes).toContain('DESTINATION_NOT_ALLOWED');
  });

  it('rejects on high-severity injection flag (INJECTION_FLAGGED)', () => {
    const inspection: InspectionResult = {
      source: 'listing:abc',
      flags: [{ code: 'HIDDEN_INSTRUCTION', severity: 'high' }],
      evidence: ['System override prompt detected'],
      findings: {},
    };
    const res = verifyPolicy(baseIntent, baseProposal, inspection, fixedNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('INJECTION_FLAGGED');
  });

  it('reviews on medium/low severity injection flag when otherwise valid (INJECTION_FLAGGED -> review)', () => {
    const inspection: InspectionResult = {
      source: 'listing:abc',
      flags: [{ code: 'SUSPICIOUS_FORMATTING', severity: 'medium' }],
      evidence: ['Invisible text block'],
      findings: {},
    };
    const res = verifyPolicy(baseIntent, baseProposal, inspection, fixedNow);
    expect(res.decision).toBe('review');
    expect(res.reasonCodes).toContain('INJECTION_FLAGGED');
  });

  it('hard mismatch overrides soft review flag to reject', () => {
    const inspection: InspectionResult = {
      source: 'listing:abc',
      flags: [{ code: 'SUSPICIOUS_FORMATTING', severity: 'low' }],
      evidence: [],
      findings: {},
    };
    const mismatchProposal: PurchaseProposal = { ...baseProposal, seller: 'bad-seller' };
    const res = verifyPolicy(baseIntent, mismatchProposal, inspection, fixedNow);
    expect(res.decision).toBe('reject');
    expect(res.reasonCodes).toContain('SELLER_MISMATCH');
    expect(res.reasonCodes).toContain('INJECTION_FLAGGED');
  });


  it('rejects case and whitespace changes in every identity field', () => {
    for (const field of ['seller', 'product', 'destination'] as const) {
      const reason = { seller: 'SELLER_MISMATCH', product: 'PRODUCT_MISMATCH', destination: 'DESTINATION_NOT_ALLOWED' }[field];
      for (const value of [baseProposal[field].toUpperCase(), ` ${baseProposal[field]}`]) {
        expect(verifyPolicy(baseIntent, { ...baseProposal, [field]: value }, undefined, fixedNow).reasonCodes).toContain(reason);
      }
    }
  });

  it('rejects malformed expiry and clock values', () => {
    expect(verifyPolicy({ ...baseIntent, expiry: 'invalid' }, baseProposal, undefined, fixedNow).decision).toBe('reject');
    expect(verifyPolicy(baseIntent, baseProposal, undefined, new Date(NaN)).decision).toBe('reject');
  });

  it('is purely deterministic: same input produces identical output across calls', () => {
    const res1 = verifyPolicy(baseIntent, baseProposal, undefined, fixedNow);
    const res2 = verifyPolicy(baseIntent, baseProposal, undefined, fixedNow);
    expect(res1).toEqual(res2);
  });
});
