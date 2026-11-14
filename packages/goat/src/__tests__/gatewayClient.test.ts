import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpGoatGatewayAuthority } from '../gatewayClient.js';
import type { PurchaseProposal } from '@trendie/contracts';
import { GOAT_NATIVE_SCALE } from '../types.js';

describe('HTTP GoatGatewayAuthority fail-closed bridge', () => {
  afterEach(() => vi.unstubAllGlobals());

  const proposal: PurchaseProposal = {
    version: 1,
    ownerId: 'user_1',
    intentId: 'intent_1',
    intentVersion: 1,
    platform: 'goat',
    itemId: 'item_1',
    sellerId: 'seller_1',
    money: { amount: '100', scale: GOAT_NATIVE_SCALE },
    asset: 'BTC',
    chain: 'goat-testnet',
  };

  it('denies claims without making an HTTP request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const authority = createHttpGoatGatewayAuthority({ baseUrl: 'http://gateway', apiKey: 'key' });

    const result = await authority.claimExecution({
      callerOwnerId: 'user_1', approvalReference: 'approval_1', proposal,
      fingerprint: 'caller-fingerprint',
      spendAuthorization: { ownerId: 'user_1', authorizationId: 'auth_1', maxAmountWei: '100' },
      now: 1,
    });

    expect(result.status).toBe('denied');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails checkpoint and outcome writes before making an HTTP request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const authority = createHttpGoatGatewayAuthority({ baseUrl: 'http://gateway', apiKey: 'key' });

    await expect(authority.recordSubmissionCheckpoint({
      executionId: 'execution_1', phase: 'broadcast', txHash: `0x${'1'.repeat(64)}`,
    })).rejects.toThrow(/unsupported/);
    await expect(authority.recordOutcome({ executionId: 'execution_1', status: 'unknown' }))
      .rejects.toThrow(/unsupported/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns no reconciliation record and makes no HTTP request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const authority = createHttpGoatGatewayAuthority({ baseUrl: 'http://gateway', apiKey: 'key' });

    await expect(authority.getExecutionForReconciliation({
      callerOwnerId: 'user_1', executionId: 'execution_1',
    })).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
