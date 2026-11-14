import { describe, it, expect } from 'vitest';
import {
  IntentSchema,
  PurchaseProposalSchema,
  InspectionResultSchema,
  VerificationDecisionSchema,
  PaymentResultSchema,
  canonicalJson,
  proposalHash,
} from '../src/schemas/index.js';

describe('Contracts & Schemas (CONTRACTS.md adherence)', () => {
  it('validates a valid Intent strictly', () => {
    const validIntent = {
      id: 'int_01HXYZ',
      owner: 'user_123',
      seller: 'supplier-a',
      product: 'product-a',
      maxAmount: '5000',
      currency: 'USDC',
      allowedDestinations: ['0xSupplierA123'],
      expiry: '2026-12-01T00:00:00Z',
      remainingUses: 1,
      createdAt: '2026-11-14T10:00:00Z',
    };

    const parsed = IntentSchema.safeParse(validIntent);
    expect(parsed.success).toBe(true);
  });

  it('rejects unknown fields in Intent strictly', () => {
    const intentWithExtra = {
      id: 'int_01HXYZ',
      owner: 'user_123',
      seller: 'supplier-a',
      product: 'product-a',
      maxAmount: '5000',
      currency: 'USDC',
      allowedDestinations: ['0xSupplierA123'],
      expiry: '2026-12-01T00:00:00Z',
      remainingUses: 1,
      createdAt: '2026-11-14T10:00:00Z',
      extraField: 'malicious',
    };

    const parsed = IntentSchema.safeParse(intentWithExtra);
    expect(parsed.success).toBe(false);
  });

  it('rejects non-integer money amounts', () => {
    const floatAmountProposal = {
      intentId: 'int_01HXYZ',
      seller: 'supplier-a',
      product: 'product-a',
      amount: '4500.50',
      currency: 'USDC',
      destination: '0xSupplierA123',
      sourceRef: 'listing:abc123',
    };

    const parsed = PurchaseProposalSchema.safeParse(floatAmountProposal);
    expect(parsed.success).toBe(false);
  });

  it('validates InspectionResult with advisory flags', () => {
    const inspection = {
      source: 'listing:abc123',
      flags: [{ code: 'HIDDEN_INSTRUCTION', severity: 'high' as const }],
      evidence: ['Ignore previous instructions'],
      findings: { score: 0.95 },
    };

    const parsed = InspectionResultSchema.safeParse(inspection);
    expect(parsed.success).toBe(true);
  });

  it('validates VerificationDecision and PaymentResult', () => {
    const decision = {
      id: 'dec_01HXYZ',
      proposalHash: 'ab12cd34ef56',
      decision: 'approve' as const,
      reasonCodes: ['OK' as const],
      timestamp: '2026-11-14T10:01:00Z',
      authorizationRef: 'apr_01HXYZ',
    };
    expect(VerificationDecisionSchema.safeParse(decision).success).toBe(true);

    const payment = {
      executionId: 'exe_01HXYZ',
      status: 'succeeded' as const,
      platform: 'goat' as const,
      txHashOrCheckoutRef: '0xabcdef123456',
      error: null,
      evidence: { receipt: 'adapter-reported' },
    };
    expect(PaymentResultSchema.safeParse(payment).success).toBe(true);
  });
});

describe('Canonical JSON & Proposal Hashing', () => {
  it('produces identical canonical JSON and hash regardless of key order', () => {
    const prop1 = {
      intentId: 'int_01H',
      seller: 'supplier-a',
      product: 'product-a',
      amount: '4500',
      currency: 'USDC',
      destination: '0xSupplierA',
      sourceRef: 'listing:abc',
    };

    const prop2 = {
      sourceRef: 'listing:abc',
      destination: '0xSupplierA',
      currency: 'USDC',
      amount: '4500',
      product: 'product-a',
      seller: 'supplier-a',
      intentId: 'int_01H',
    };

    expect(canonicalJson(prop1)).toBe(canonicalJson(prop2));
    expect(proposalHash(prop1)).toBe(proposalHash(prop2));
  });

  it('preserves string whitespace during hashing', () => {
    const prop1 = {
      intentId: 'int_01H',
      seller: 'supplier-a',
      product: 'product-a',
      amount: '4500',
      currency: 'USDC',
      destination: '0xSupplierA',
      sourceRef: 'listing:abc',
    };

    const prop2 = {
      ...prop1,
      seller: '  supplier-a  ',
    };

    expect(proposalHash(prop1)).not.toBe(proposalHash(prop2));
  });

  it('changes hash when any field value changes', () => {
    const prop1 = {
      intentId: 'int_01H',
      seller: 'supplier-a',
      product: 'product-a',
      amount: '4500',
      currency: 'USDC',
      destination: '0xSupplierA',
      sourceRef: 'listing:abc',
    };

    const prop2 = {
      ...prop1,
      amount: '4501',
    };

    expect(proposalHash(prop1)).not.toBe(proposalHash(prop2));
  });
});
