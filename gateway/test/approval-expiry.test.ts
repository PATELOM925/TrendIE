import { describe, expect, it } from 'vitest';
import { capApprovalExpiry, isIntentActive } from '../src/approvals/expiry.js';
import { verifyPolicy } from '../src/policy/verify.js';
import type { Intent, PurchaseProposal, InspectionResult } from '../src/schemas/index.js';

const now = new Date('2026-01-01T00:00:00.000Z');
const proposal: PurchaseProposal = {
  intentId: 'i', seller: 's', product: 'p', amount: '1', currency: 'USD', destination: 'd', sourceRef: 'r',
};
const intent: Intent = {
  id: 'i', owner: 'o', seller: 's', product: 'p', maxAmount: '2', currency: 'USD',
  allowedDestinations: ['d'], expiry: '2026-01-01T00:00:01.000Z', remainingUses: 1, createdAt: now.toISOString(),
};
const inspection = (severity: InspectionResult['flags'][number]['severity']): InspectionResult => ({
  source: 'test', flags: [{ code: 'flag', severity }], evidence: [], findings: {},
});

describe('approval expiry and review policy', () => {
  it('caps approval one second before intent expiry', () => {
    expect(capApprovalExpiry(now, 60, intent.expiry)).toBe(intent.expiry);
  });
  it('denies intent expiry at the exact boundary', () => {
    expect(isIntentActive(intent.expiry, new Date(intent.expiry))).toBe(false);
    expect(verifyPolicy(intent, proposal, undefined, new Date(intent.expiry)).reasonCodes).toContain('INTENT_EXPIRED');
  });
  it('rejects stale or mismatched review proposals', () => {
    const stale = verifyPolicy({ ...intent, expiry: now.toISOString() }, proposal, undefined, now);
    const mismatch = verifyPolicy(intent, { ...proposal, seller: 'other' }, undefined, now);
    expect(stale.decision).toBe('reject');
    expect(mismatch.decision).toBe('reject');
  });
  it('allows human approval of medium advisory review', () => {
    expect(verifyPolicy(intent, proposal, inspection('medium'), now).decision).toBe('review');
  });
  it('does not allow human approval to bypass high severity', () => {
    expect(verifyPolicy(intent, proposal, inspection('high'), now).decision).toBe('reject');
  });
});
