import { describe, it, expect, vi } from 'vitest';
import { createHttpGatewayAuthority } from '../gatewayClient.js';
import { PurchaseProposal } from '@trendie/contracts';

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
    providerArgs: {
      destination: 'supplier_a',
      sourceRef: 'listing:item_1',
    },
  };

  it('claims execution via gateway /approvals/:id/consume with adapter-qatom role', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ executionId: 'exe_qatom_123' }),
    });
    global.fetch = fetchMock;

    const authority = createHttpGatewayAuthority({
      baseUrl: 'http://localhost:3000',
      apiKey: 'qatom-adapter-secret-key-789',
    });

    const result = await authority.claimExecution({
      caller: { ownerId: 'user_1' },
      approvalReference: 'apr_test_123',
      proposal,
      fingerprint: 'fp_123',
    });

    expect(result.kind).toBe('claimed');
    if (result.kind === 'claimed') {
      expect(result.binding.executionId).toBe('exe_qatom_123');
      expect(result.binding.platform).toBe('qatom');
    }

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/approvals/apr_test_123/consume',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': 'qatom-adapter-secret-key-789',
        }),
      })
    );
  });

  it('handles 403 Forbidden from gateway when approval is invalid or tampered', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 403,
      json: async () => ({ message: 'Approval cannot be consumed: CONSUME_FAILED' }),
    });
    global.fetch = fetchMock;

    const authority = createHttpGatewayAuthority({
      baseUrl: 'http://localhost:3000',
      apiKey: 'qatom-adapter-secret-key-789',
    });

    const result = await authority.claimExecution({
      caller: { ownerId: 'user_1' },
      approvalReference: 'apr_bad',
      proposal,
      fingerprint: 'fp_123',
    });

    expect(result.kind).toBe('denied');
    if (result.kind === 'denied') {
      expect(result.reason).toContain('Approval cannot be consumed');
    }
  });

  it('records outcome via gateway /executions/:id/result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({}),
    });
    global.fetch = fetchMock;

    const authority = createHttpGatewayAuthority({
      baseUrl: 'http://localhost:3000',
      apiKey: 'qatom-adapter-secret-key-789',
    });

    await authority.recordOutcome('exe_qatom_123', {
      executionId: 'exe_qatom_123',
      status: 'succeeded',
      platform: 'qatom',
      actual: {
        itemId: 'item_1',
        money: { amount: '4500', scale: 3 },
        receiptId: 'rcpt_qatom_999',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/executions/exe_qatom_123/result',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': 'qatom-adapter-secret-key-789',
        }),
      })
    );
  });
});
