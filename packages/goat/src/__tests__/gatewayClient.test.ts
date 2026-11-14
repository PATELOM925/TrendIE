import { describe, it, expect, vi } from 'vitest';
import { createHttpGoatGatewayAuthority } from '../gatewayClient.js';
import type { PurchaseProposal } from '@trendie/contracts';
import { GOAT_NATIVE_SCALE } from '../types.js';

describe('HTTP GoatGatewayAuthority for adapter-goat', () => {
  const proposal: PurchaseProposal = {
    version: 1,
    ownerId: 'user_1',
    intentId: 'int_goat_01',
    intentVersion: 1,
    platform: 'goat',
    itemId: 'transfer-item',
    sellerId: 'recipient_0x',
    money: { amount: '1000000000000000', scale: GOAT_NATIVE_SCALE },
    asset: 'BTC',
    chain: 'goat-testnet',
    providerArgs: {
      recipient: '0x000000000000000000000000000000000000dEaD',
      sourceRef: 'goat:tx:1',
    },
  };

  it('claims execution via gateway /approvals/:id/consume with adapter-goat role', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ executionId: 'exe_goat_999' }),
    });
    global.fetch = fetchMock;

    const authority = createHttpGoatGatewayAuthority({
      baseUrl: 'http://localhost:3000',
      apiKey: 'goat-adapter-secret-key-456',
    });

    const result = await authority.claimExecution({
      callerOwnerId: 'user_1',
      approvalReference: 'apr_goat_123',
      proposal,
      fingerprint: 'fp_goat_123',
      spendAuthorization: {
        ownerId: 'user_1',
        authorizationId: 'auth_1',
        maxAmountWei: '2000000000000000',
      },
      now: 1000,
    });

    expect(result.status).toBe('claimed');
    if (result.status === 'claimed') {
      expect(result.executionId).toBe('exe_goat_999');
      expect(result.binding.platform).toBe('goat');
      expect(result.binding.destination).toBe('0x000000000000000000000000000000000000dEaD');
    }

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/approvals/apr_goat_123/consume',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': 'goat-adapter-secret-key-456',
        }),
      })
    );
  });

  it('handles 403 Forbidden from gateway when approval is invalid or expired', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 403,
      json: async () => ({ message: 'Approval cannot be consumed: EXPIRED' }),
    });
    global.fetch = fetchMock;

    const authority = createHttpGoatGatewayAuthority({
      baseUrl: 'http://localhost:3000',
      apiKey: 'goat-adapter-secret-key-456',
    });

    const result = await authority.claimExecution({
      callerOwnerId: 'user_1',
      approvalReference: 'apr_bad',
      proposal,
      fingerprint: 'fp_bad',
      spendAuthorization: {
        ownerId: 'user_1',
        authorizationId: 'auth_1',
        maxAmountWei: '2000000000000000',
      },
      now: 1000,
    });

    expect(result.status).toBe('denied');
    if (result.status === 'denied') {
      expect(result.reason).toContain('Approval cannot be consumed');
    }
  });

  it('records outcome via gateway /executions/:id/result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({}),
    });
    global.fetch = fetchMock;

    const authority = createHttpGoatGatewayAuthority({
      baseUrl: 'http://localhost:3000',
      apiKey: 'goat-adapter-secret-key-456',
    });

    await authority.recordOutcome({
      executionId: 'exe_goat_999',
      status: 'succeeded',
      providerReference: '0xgoat_tx_hash_12345',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/executions/exe_goat_999/result',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': 'goat-adapter-secret-key-456',
        }),
      })
    );
  });
});
