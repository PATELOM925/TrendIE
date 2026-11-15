import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

describe('POST /api/agent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('fails closed for live model requests before contacting the gateway', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GEMINI_API_KEY', 'must-not-be-used');

    const request = new Request('http://localhost:3001/api/agent', {
      method: 'POST',
      headers: { origin: 'http://localhost:3001', 'content-type': 'application/json' },
      body: JSON.stringify({
        intentId: 'int_demo',
        untrustedText: 'synthetic text',
        useLiveModel: true,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Live model calls are disabled until a separate numeric spend limit is approved and enforced.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-boolean live model settings', async () => {
    const request = new Request('http://localhost:3001/api/agent', {
      method: 'POST',
      headers: { origin: 'http://localhost:3001', 'content-type': 'application/json' },
      body: JSON.stringify({
        intentId: 'int_demo',
        untrustedText: 'synthetic text',
        useLiveModel: 'true',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'useLiveModel must be false.' });
  });

  it('rejects malformed amount and currency instead of verifying substituted values', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('http://localhost:3001/api/agent', {
      method: 'POST',
      headers: { origin: 'http://localhost:3001', 'content-type': 'application/json' },
      body: JSON.stringify({
        intentId: 'int_demo',
        untrustedText: 'synthetic text',
        seller: 'Seller',
        product: 'Product',
        amount: '1.25',
        currency: 'USD',
        destination: 'demo-recipient',
        useLiveModel: false,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid synthetic proposal request.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not turn an incomplete gateway 200 response into a decision', async () => {
    vi.stubEnv('GATEWAY_BASE_URL', 'http://127.0.0.1:3000');
    vi.stubEnv('API_KEY_DASHBOARD', 'dashboard-test-key');
    vi.stubEnv('API_KEY_AGENT', 'agent-test-key');
    vi.stubEnv('DEMO_OWNER_ID', 'local-demo-owner');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ id: 'int_demo', owner: 'local-demo-owner' }))
      .mockResolvedValueOnce(Response.json({ decision: 'approve' })));

    const request = new Request('http://localhost:3001/api/agent', {
      method: 'POST',
      headers: { origin: 'http://localhost:3001', 'content-type': 'application/json' },
      body: JSON.stringify({
        intentId: 'int_demo',
        untrustedText: 'synthetic text',
        seller: 'Seller',
        product: 'Product',
        amount: '100',
        currency: 'USDC',
        destination: 'demo-recipient',
        useLiveModel: false,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Gateway verification did not return a confirmed decision.' });
  });
});
