import { describe, expect, it } from 'vitest';
import { runControlledComparison, validateEvidence, type Listing, type TrustedTask } from '../index.js';

const task: TrustedTask = { ownerId: 'owner', intentId: 'intent', intentVersion: 2, platform: 'goat', chain: 'test', task: 'buy item', maxAmount: '10', maxScale: 0, asset: 'USD' };
const listing: Listing = { itemId: 'item', sellerId: 'seller', title: 'Title', amount: '4', scale: 0, asset: 'USD', description: 'clean', sourceRef: 'fixture://one' };
const model = { async propose() { return { itemId: 'item', sellerId: 'attacker', money: { amount: '11', scale: 0 }, asset: 'USD', providerArgs: { recipient: 'bad' } }; } };

describe('controlled comparison', () => {
  it('records the changed candidate in simulation and passes it to gateway for rejection', async () => {
    let discoveries = 0; let calls = 0;
    const out = await runControlledComparison({ task, query: 'item', discovery: { async search() { discoveries++; return [listing]; } }, model, modelMode: 'fixture', gateway: { async verify(p, e) { calls++; expect(p.sellerId).toBe('attacker'); expect(e.canonicalProposalFingerprint).toBeTruthy(); return { decision: 'reject', reasons: ['SELLER_MISMATCH'] }; } } });
    expect(discoveries).toBe(1); expect(calls).toBe(1); expect(out.vulnerable.action).toMatchObject({ simulation: true, recipient: 'bad', amount: '11', scale: 0, asset: 'USD' }); expect(out.vulnerable.executed).toBe(false); expect(out.vulnerable.providerDispatch).toBe(false); expect(out.protected.outcome).toBe('NOT_SETTLED');
  });
  it('allows deterministic gateway approval without claiming settlement', async () => {
    const candidate = { itemId: 'item', sellerId: 'seller', money: { amount: '4', scale: 0 }, asset: 'USD', providerArgs: {} };
    const out = await runControlledComparison({ task, query: 'item', discovery: { async search() { return [listing]; } }, model: { async propose() { return candidate; } }, modelMode: 'injected', gateway: { async verify(p) { return { decision: p.sellerId === 'seller' ? 'approve' : 'reject', reasons: ['OK'] }; } } });
    expect(out.protected.decision).toBe('approve'); expect(out.protected.outcome).toBe('NOT_SETTLED');
  });
  it('rejects tampered evidence and requires references', async () => {
    const out = await runControlledComparison({ task, query: 'item', discovery: { async search() { return [listing]; } }, model, modelMode: 'fixture', gateway: { async verify() { return { decision: 'review', reasons: [] }; } } });
    expect(() => validateEvidence({ ...out.evidence, sourceRefs: [] }, out.proposal)).toThrow();
    expect(() => validateEvidence({ ...out.evidence, canonicalProposalFingerprint: '0'.repeat(64) }, out.proposal)).toThrow();
    await expect(runControlledComparison({ task, query: 'item', discovery: { async search() { return [{ ...listing, sourceRef: undefined }]; } }, model, modelMode: 'fixture', gateway: { async verify() { return { decision: 'reject', reasons: [] }; } } })).rejects.toThrow();
  });
  it('rejects identity injection and times out hung ports with generic provider errors', async () => {
    await expect(runControlledComparison({ task, query: 'item', discovery: { async search() { return [listing]; } }, model: { async propose() { return { itemId: 'item', sellerId: 'seller', money: { amount: '4', scale: 0 }, asset: 'USD', ownerId: 'intruder' }; } }, modelMode: 'fixture', gateway: { async verify() { return { decision: 'reject', reasons: [] }; } } })).rejects.toThrow();
    await expect(runControlledComparison({ task, query: 'item', discovery: { async search() { throw new Error('secret provider detail'); } }, model, modelMode: 'fixture', gateway: { async verify() { return { decision: 'reject', reasons: [] }; } } })).rejects.toThrow('Comparison failed');
    await expect(runControlledComparison({ task, query: 'item', discovery: { async search() { return new Promise(() => {}); } }, model, modelMode: 'fixture', limits: { timeoutMs: 10 }, gateway: { async verify() { return { decision: 'reject', reasons: [] }; } } })).rejects.toThrow('Comparison timed out');
  });
});
