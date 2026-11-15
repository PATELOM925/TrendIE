import { describe, expect, it, vi } from 'vitest';
import { proposalFingerprint, type PurchaseProposal } from '@trendie/contracts';
import { createHttpGoatGatewayAuthority } from '../gatewayClient.js';
import { GOAT_NATIVE_ASSET, GOAT_NATIVE_SCALE, GOAT_TESTNET_CHAIN_ID } from '../types.js';

const recipient = '0x000000000000000000000000000000000000dEaD';
const sender = '0x0000000000000000000000000000000000000002';
const proposal: PurchaseProposal = { version: 1, ownerId: 'user_1', intentId: 'intent_1', intentVersion: 1, platform: 'goat', itemId: 'item_1', sellerId: 'seller_1', money: { amount: '1000000000000000', scale: GOAT_NATIVE_SCALE }, asset: GOAT_NATIVE_ASSET, chain: 'goat-testnet', providerArgs: { recipient } };
const auth = { ownerId: 'user_1', authorizationId: 'auth_1', maxAmountWei: '2000000000000000' };
const fingerprint = proposalFingerprint(proposal);
const binding = { platform: 'goat', fingerprint, ownerId: proposal.ownerId, intentId: proposal.intentId, intentVersion: proposal.intentVersion, sender, destination: recipient, asset: GOAT_NATIVE_ASSET, chainId: GOAT_TESTNET_CHAIN_ID, amount: proposal.money.amount, scale: GOAT_NATIVE_SCALE, expiresAt: 20_000, spendAuthorizationId: auth.authorizationId, spendCeilingWei: auth.maxAmountWei };
const stream = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const authority = (fetchFn: typeof fetch, timeoutMs?: number) => createHttpGoatGatewayAuthority({ baseUrl: 'http://127.0.0.1:3000', apiKey: 'test', mode: 'active', fetchFn, timeoutMs });
const claimInput = { callerOwnerId: 'user_1', approvalReference: 'apr-1', proposal, fingerprint, spendAuthorization: auth, now: 10_000 };
const envelope = (overrides: Record<string, unknown> = {}) => ({ version: 1, kind: 'claim', status: 'claimed', executionId: 'exec-1', proposal, binding, ...overrides });

describe('HTTP GOAT gateway V1 authority', () => {
  it('accepts only a complete persisted proposal and binding envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(stream(envelope()));
    const result = await authority(fetchMock).claimExecution(claimInput);
    expect(result).toMatchObject({ status: 'claimed', executionId: 'exec-1', binding });
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/v1/goat/approvals/apr-1/claim');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
  });
  it('denies legacy bare execution IDs and altered authority fields', async () => {
    for (const body of [{ executionId: 'exec-1' }, envelope({ binding: { ...binding, destination: sender } }), envelope({ binding: { ...binding, amount: '1' } }), envelope({ binding: { ...binding, ownerId: 'other' } }), envelope({ binding: { ...binding, chainId: 1 } }), envelope({ binding: { ...binding, fingerprint: 'f'.repeat(64) } }), envelope({ proposal: { ...proposal, money: { ...proposal.money, amount: '1' } } })]) {
      const result = await authority(vi.fn().mockResolvedValue(stream(body))).claimExecution(claimInput);
      expect(result.status).toBe('denied');
    }
  });
  it('denies false/malformed acknowledgements and accepts exact persisted acknowledgements', async () => {
    const input = { executionId: 'exec-1', phase: 'broadcast' as const, txHash: `0x${'a'.repeat(64)}` as `0x${string}` };
    for (const ack of [{}, { version: 1, kind: 'checkpoint_ack', status: 'failed', executionId: 'exec-1', phase: input.phase, txHash: input.txHash }]) await expect(authority(vi.fn().mockResolvedValue(stream(ack))).recordSubmissionCheckpoint(input)).rejects.toThrow();
    const ack = { version: 1, kind: 'checkpoint_ack', status: 'persisted', executionId: input.executionId, phase: input.phase, txHash: input.txHash };
    await expect(authority(vi.fn().mockResolvedValue(stream(ack))).recordSubmissionCheckpoint(input)).resolves.toBeUndefined();
  });
  it('rejects oversized and hung response bodies, bounds timeout options, and makes no default fetch', async () => {
    const oversized = new Response(new Uint8Array(64_001));
    expect((await authority(vi.fn().mockResolvedValue(oversized)).claimExecution(claimInput)).status).toBe('denied');
    const hung = vi.fn().mockImplementation(() => new Promise(() => undefined));
    expect((await authority(hung, 10).claimExecution(claimInput)).status).toBe('denied');
    expect(() => authority(fetch, 0)).toThrow(RangeError);
    const fetchMock = vi.fn();
    const disabled = createHttpGoatGatewayAuthority({ baseUrl: 'http://localhost', apiKey: 'x', fetchFn: fetchMock });
    expect((await disabled.claimExecution(claimInput)).status).toBe('denied');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
