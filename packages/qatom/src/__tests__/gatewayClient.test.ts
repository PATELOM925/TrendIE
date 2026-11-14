import { afterEach, describe, it, expect, vi } from 'vitest';
import { createHttpGatewayAuthority } from '../gatewayClient.js';
import { proposalFingerprint, type PurchaseProposal } from '@trendie/contracts';

describe('HTTP GatewayAuthority for adapter-qatom', () => {
  const proposal: PurchaseProposal = {
    version: 1,
    ownerId: 'user_1',
    intentId: 'int_01',
    intentVersion: 1,
    platform: 'qatom',
    itemId: 'item_1',
    sellerId: 'supplier_a',
    money: { amount: '4500', scale: 3 },
    asset: 'USD-TDN',
    chain: 'qatom',
    providerArgs: { destination: 'supplier_a', sourceRef: 'listing:item_1' },
  };

  afterEach(() => vi.unstubAllGlobals());

  it('fails closed without making HTTP claim or outcome calls', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const authority = createHttpGatewayAuthority({ baseUrl: 'http://localhost:3000', apiKey: 'test-key' });

    const claim = await authority.claimExecution({
      caller: { ownerId: 'user_1' }, approvalReference: 'apr_test_123', proposal,
      fingerprint: proposalFingerprint(proposal),
    });

    expect(claim).toMatchObject({ kind: 'denied' });
    await expect(authority.recordOutcome('exec_1', {
      executionId: 'exec_1', platform: 'qatom', status: 'unknown',
    })).rejects.toThrow(/unsupported/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed on continuation without making an HTTP claim call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const authority = createHttpGatewayAuthority({ baseUrl: 'http://localhost:3000', apiKey: 'test-key' });
    const result = await authority.claimContinuation({
      caller: { ownerId: 'user_1' }, approvalReference: 'apr_test_123',
      executionId: 'exec_1', providerReference: 'provider-ref',
    });

    expect(result).toMatchObject({ kind: 'denied' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
