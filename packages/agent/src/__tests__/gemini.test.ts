import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGeminiModel } from '../gemini.js';

const listing = {
  itemId: 'item-1',
  sellerId: 'Supplier A',
  title: 'Product A',
  amount: '100',
  scale: 6,
  asset: 'USDC',
};

const validGeminiResponse = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              itemId: 'item-1',
              sellerId: 'Supplier A',
              money: { amount: '100', scale: 6 },
              asset: 'USDC',
              providerArgs: { recipient: '0x1234567890123456789012345678901234567890' },
            }),
          },
        ],
      },
    },
  ],
};

const input = (signal = new AbortController().signal) => ({
  task: 'buy Product A',
  listings: [listing],
  signal,
  maxTurns: 1,
  maxToolCalls: 1,
});

describe('Gemini Model Adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws an error if GEMINI_API_KEY is not configured', () => {
    expect(() => createGeminiModel({ apiKey: '' })).toThrow('GEMINI_API_KEY is required');
  });

  it('formulates request with JSON mode and parses structured proposal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validGeminiResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const model = createGeminiModel({ apiKey: 'fake-test-key-12345' });
    const result = await model.propose(input());

    expect(result).toEqual({
      itemId: 'item-1',
      sellerId: 'Supplier A',
      money: { amount: '100', scale: 6 },
      asset: 'USDC',
      providerArgs: { recipient: '0x1234567890123456789012345678901234567890' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('gemini-3.5-flash');
    expect(calledUrl).toContain('key=fake-test-key-12345');
  });

  it('handles abort signals gracefully', async () => {
    const controller = new AbortController();
    controller.abort();

    const model = createGeminiModel({ apiKey: 'fake-test-key-12345' });
    await expect(model.propose(input(controller.signal))).rejects.toThrow('Model request aborted');
  });

  it('throws on non-200 API response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'API key invalid',
    });
    vi.stubGlobal('fetch', fetchMock);

    const model = createGeminiModel({ apiKey: 'fake-test-key-12345' });
    await expect(model.propose(input())).rejects.toThrow('Gemini API error (HTTP 403)');
  });
});
