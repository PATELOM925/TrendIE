import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

describe('GET /api/audit', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns only allowlisted audit fields and never returns approval references or raw payloads', async () => {
    vi.stubEnv('GATEWAY_BASE_URL', 'http://127.0.0.1:3000');
    vi.stubEnv('API_KEY_DASHBOARD', 'dashboard-test-key');
    vi.stubEnv('API_KEY_AGENT', 'agent-test-key');
    vi.stubEnv('DEMO_OWNER_ID', 'local-demo-owner');

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/intents')) {
        return Promise.resolve(Response.json({
          intents: [{
            id: 'int_owned', owner: 'local-demo-owner', seller: 'Synthetic Seller', product: 'Synthetic Product',
            maxAmount: '1000000', currency: 'USDC', allowedDestinations: ['demo-recipient'],
            expiry: '2030-01-01T00:00:00.000Z', remainingUses: 1, createdAt: '2026-11-14T12:00:00.000Z',
          }],
        }));
      }
      return Promise.resolve(Response.json([
        {
          event_type: 'INTENT_CREATED', entity_type: 'intent', entity_id: 'int_owned',
          created_at: '2026-11-14T12:00:00.000Z',
          payload: { seller: 'Synthetic Seller', product: 'Synthetic Product', owner: 'local-demo-owner' },
        },
        {
          event_type: 'PROPOSAL_VERIFIED', entity_type: 'decision', entity_id: 'dec_private',
          created_at: '2026-11-14T12:01:00.000Z',
          payload: { decision: 'approve', authorizationRef: 'one-use-secret-reference', rawProposal: 'private data' },
        },
      ]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();
    expect(response.status).toBe(200);
    const serialized = await response.text();
    expect(serialized).toContain('Synthetic Seller');
    expect(serialized).not.toContain('one-use-secret-reference');
    expect(serialized).not.toContain('rawProposal');
    expect(serialized).not.toContain('dec_private');
  });
});
