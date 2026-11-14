import { describe, expect, it } from 'vitest';
import { canonicalJson, MoneySchema, PaymentResultSchema, proposalFingerprint, PurchaseProposalSchema } from './index.js';

const proposal = {
  version: 1 as const, ownerId: 'buyer-1', intentId: 'intent-1', intentVersion: 2,
  platform: 'qatom' as const, itemId: 'item-1', sellerId: 'seller-1',
  money: { amount: '1200', scale: 3 }, asset: 'USD-TDN', chain: 'qatom', providerArgs: { quantity: 1 },
};

describe('payment contracts', () => {
  it('accepts integer-string money and rejects floats, signs, and unknown fields', () => {
    expect(MoneySchema.parse({ amount: '0', scale: 3 })).toEqual({ amount: '0', scale: 3 });
    expect(MoneySchema.parse({ amount: '1', scale: 255 })).toEqual({ amount: '1', scale: 255 });
    for (const amount of [1.2, '1.2', '-1', '+1', '01', 'NaN']) expect(MoneySchema.safeParse({ amount, scale: 3 }).success).toBe(false);
    expect(MoneySchema.safeParse({ amount: '1', scale: 3, currency: 'USD' }).success).toBe(false);
    expect(MoneySchema.safeParse({ amount: '1', scale: 256 }).success).toBe(false);
  });

  it('validates strict versioned proposals and fingerprints nested keys deterministically', () => {
    expect(PurchaseProposalSchema.parse(proposal)).toEqual(proposal);
    expect(proposalFingerprint(proposal)).toBe(proposalFingerprint({ ...proposal, providerArgs: { quantity: 1 } }));
    expect(proposalFingerprint(proposal)).toHaveLength(64);
    expect(PurchaseProposalSchema.safeParse({ ...proposal, debug: true }).success).toBe(false);
    expect(PurchaseProposalSchema.safeParse({ ...proposal, money: { amount: '1200', scale: 2 } }).success).toBe(false);
  });

  it('requires evidence for failed results and actual receipt fields for success', () => {
    expect(PaymentResultSchema.safeParse({ executionId: 'exec-1', platform: 'qatom', status: 'failed' }).success).toBe(false);
    expect(PaymentResultSchema.safeParse({ executionId: 'exec-1', platform: 'qatom', status: 'succeeded', actual: { itemId: 'item-1', money: proposal.money } }).success).toBe(false);
    expect(PaymentResultSchema.safeParse({ executionId: 'exec-1', platform: 'qatom', status: 'succeeded', actual: { itemId: 'item-1', money: proposal.money, receiptId: 'tx-1' } }).success).toBe(true);
  });

  it('rejects unsupported, non-finite, unsafe, cyclic, and over-deep canonical values', () => {
    expect(() => canonicalJson({ x: undefined })).toThrow();
    expect(() => canonicalJson({ x: () => 1 })).toThrow();
    expect(() => canonicalJson({ x: Number.NaN })).toThrow();
    expect(() => canonicalJson({ x: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
    expect(canonicalJson({ x: 0.5 })).toBe('{"x":0.5}');
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow();
    expect(() => canonicalJson(new Date())).toThrow();
    expect(() => canonicalJson(Object.defineProperty({}, 'secret', { get: () => 'no' }))).toThrow();
    const sparse = new Array(2);
    expect(() => canonicalJson(sparse)).toThrow();
    const withSymbol = { [Symbol('x')]: 1 };
    expect(() => canonicalJson(withSymbol)).toThrow();
    expect(() => canonicalJson(JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow();
    expect(() => canonicalJson('x'.repeat(300_000))).toThrow();
  });
});
