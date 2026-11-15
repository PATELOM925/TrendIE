import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyProposalWithGateway } from './gateway-verification';

describe('verifyProposalWithGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('persists server-derived PDF truncation and original extracted character count', async () => {
    vi.stubEnv('GATEWAY_BASE_URL', 'http://127.0.0.1:3000');
    vi.stubEnv('API_KEY_DASHBOARD', 'dashboard-test-key');
    vi.stubEnv('API_KEY_AGENT', 'agent-test-key');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      id: 'decision-1', proposalHash: 'hash-1', decision: 'review',
      reasonCodes: ['INJECTION_FLAGGED'], timestamp: '2026-11-14T12:00:00.000Z',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await verifyProposalWithGateway({
      intentId: 'intent-1', seller: 'Seller', product: 'Part', amount: '100',
      currency: 'USDC', destination: 'recipient-1', sourceRef: 'uploaded-pdf:invoice.pdf',
    }, { source: 'uploaded-pdf:invoice.pdf', text: 'A'.repeat(20_000) }, {
      truncated: true,
      sourceChars: 42_000,
    });

    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      inspection: { findings: { truncated: boolean; sourceChars: number } };
    };
    expect(payload.inspection.findings).toEqual(expect.objectContaining({ truncated: true, sourceChars: 42_000 }));
    expect(result.inspection.truncated).toBe(true);
    expect(result.inspection.sourceChars).toBe(42_000);
  });
});
