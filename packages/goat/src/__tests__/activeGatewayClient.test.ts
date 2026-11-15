import { describe, expect, it, vi } from 'vitest';
import { createHttpGoatGatewayAuthority } from '../gatewayClient.js';
import type { PurchaseProposal } from '@trendie/contracts';
import { GOAT_NATIVE_SCALE, GOAT_TESTNET_CHAIN_ID } from '../types.js';

describe('HTTP GoatGatewayAuthority active mode', () => {
  const proposal: PurchaseProposal = {
    version: 1,
    ownerId: 'user_1',
    intentId: 'intent_1',
    intentVersion: 1,
    platform: 'goat',
    itemId: 'item_1',
    sellerId: 'seller_1',
    money: { amount: '1000000000000000', scale: GOAT_NATIVE_SCALE },
    asset: 'BTC',
    chain: 'goat-testnet',
    providerArgs: {
      recipient: '0x000000000000000000000000000000000000dEaD',
      listingRef: 'fixture://shop/item-1',
    },
  };

  it('claims execution from gateway over HTTP in active mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ executionId: 'exec-123' }),
    });

    const authority = createHttpGoatGatewayAuthority({
      baseUrl: 'http://127.0.0.1:3000',
      apiKey: 'test-api-key',
      mode: 'active',
      fetchFn: fetchMock as unknown as typeof fetch,
      senderAddress: '0x0000000000000000000000000000000000000002',
    });

    const claim = await authority.claimExecution({
      callerOwnerId: 'user_1',
      approvalReference: 'apr-1',
      proposal,
      fingerprint: 'fp-123',
      spendAuthorization: { ownerId: 'user_1', authorizationId: 'auth_1', maxAmountWei: '2000000000000000' },
      now: 10_000,
    });

    expect(claim.status).toBe('claimed');
    if (claim.status === 'claimed') {
      expect(claim.executionId).toBe('exec-123');
      expect(claim.binding.platform).toBe('goat');
      expect(claim.binding.chainId).toBe(GOAT_TESTNET_CHAIN_ID);
      expect(claim.binding.destination).toBe('0x000000000000000000000000000000000000dEaD');
      expect(claim.binding.sender).toBe('0x0000000000000000000000000000000000000002');
    }

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/approvals/apr-1/consume',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
        },
      })
    );
  });

  it('handles already_claimed error when gateway reports consume failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'CONSUME_FAILED_HASH_OR_EXPIRED_OR_USED',
    });

    const authority = createHttpGoatGatewayAuthority({
      baseUrl: 'http://127.0.0.1:3000',
      apiKey: 'test-api-key',
      mode: 'active',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const claim = await authority.claimExecution({
      callerOwnerId: 'user_1',
      approvalReference: 'apr-1',
      proposal,
      fingerprint: 'fp-123',
      spendAuthorization: { ownerId: 'user_1', authorizationId: 'auth_1', maxAmountWei: '2000000000000000' },
      now: 10_000,
    });

    expect(claim.status).toBe('already_claimed');
  });

  it('posts submission checkpoints and outcomes to execution endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const authority = createHttpGoatGatewayAuthority({
      baseUrl: 'http://127.0.0.1:3000',
      apiKey: 'test-api-key',
      mode: 'active',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    await authority.recordSubmissionCheckpoint({
      executionId: 'exec-123',
      phase: 'broadcast',
      txHash: `0x${'a'.repeat(64)}` as `0x${string}`,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/executions/exec-123/result',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"status":"pending"'),
      })
    );

    await authority.recordOutcome({
      executionId: 'exec-123',
      status: 'succeeded',
      providerReference: `0x${'a'.repeat(64)}`,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/executions/exec-123/result',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"status":"succeeded"'),
      })
    );
  });
});
