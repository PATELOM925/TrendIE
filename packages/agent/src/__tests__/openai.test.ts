import { Usage, type Model as SDKModel, type ModelProvider } from '@openai/agents';
import { describe, expect, it } from 'vitest';
import { createOpenAIModel } from '../openai.js';

const listing = { itemId: 'item-1', sellerId: 'seller-1', title: 'Synthetic shaker', amount: '1200', scale: 3, asset: 'USD-TDN' };
const proposal = { itemId: 'item-1', sellerId: 'seller-1', money: { amount: '1200', scale: 3 }, asset: 'USD-TDN', providerArgsJson: '{"item":"item-1"}' };
type FakeMode = 'direct' | 'tool';

function fakeProvider(mode: FakeMode) {
  const requests: Array<{ input: unknown; outputType: unknown; modelSettings: { maxTokens?: number }; tracing: boolean | 'enabled_without_data' }> = [];
  let calls = 0;
  const fakeModel = {
    async getResponse(request: Parameters<SDKModel['getResponse']>[0]) {
      requests.push({ input: request.input, outputType: request.outputType, modelSettings: request.modelSettings, tracing: request.tracing });
      calls += 1;
      if (mode === 'tool' && calls === 1) return {
        usage: new Usage(),
        output: [{ type: 'function_call' as const, callId: 'call-listings', name: 'read_discovered_listings', arguments: '{}', status: 'completed' as const }],
      };
      return {
        usage: new Usage(),
        output: [{ type: 'message' as const, role: 'assistant' as const, status: 'completed' as const, content: [{ type: 'output_text' as const, text: JSON.stringify(proposal) }] }],
      };
    },
    async *getStreamedResponse() { throw new Error('streaming is not used by this adapter'); },
  } satisfies SDKModel;
  const provider: ModelProvider = { getModel: () => fakeModel };
  return { provider, requests, get calls() { return calls; } };
}

function assertStrictOutputSchema(value: unknown): asserts value is { type: 'json_schema'; schema: Record<string, unknown> } {
  expect(value).toMatchObject({ type: 'json_schema', strict: true });
  const schema = (value as { schema: Record<string, unknown> }).schema;
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const item = node as Record<string, unknown>;
    if (item.type === 'object') {
      expect(item.additionalProperties).toBe(false);
      expect(item.properties).toBeDefined();
      const properties = item.properties as Record<string, unknown>;
      for (const child of Object.values(properties)) visit(child);
    }
    if (Array.isArray(item.anyOf)) for (const child of item.anyOf) visit(child);
  };
  visit(schema);
  expect(JSON.stringify(schema)).not.toContain('"additionalProperties":true');
  expect(JSON.stringify(schema)).not.toMatch(/"type":"object","properties":\{\}/);
}

const input = (signal = new AbortController().signal) => ({ task: 'buy the shaker', listings: [listing], signal, maxTurns: 1, maxToolCalls: 1 });

describe('OpenAI adapter with the actual Agents SDK Runner', () => {
  it('uses supplied listings to produce a structured one-turn proposal without a tool call', async () => {
    const fake = fakeProvider('direct');
    const model = createOpenAIModel({ modelName: 'offline-fake', authorizeSpend: async () => 0.01, modelProvider: fake.provider });
    const result = await model.propose(input());
    expect(result).toEqual({ itemId: 'item-1', sellerId: 'seller-1', money: { amount: '1200', scale: 3 }, asset: 'USD-TDN', providerArgs: { item: 'item-1' } });
    expect(fake.calls).toBe(1);
    expect(JSON.stringify(fake.requests[0]?.input)).toContain('Synthetic shaker');
    expect(fake.requests[0]?.modelSettings.maxTokens).toBe(512);
    expect(fake.requests[0]?.tracing).toBe(false);
    assertStrictOutputSchema(fake.requests[0]?.outputType);
  });

  it('runs the optional listing tool round trip within a two-turn bound', async () => {
    const fake = fakeProvider('tool');
    const model = createOpenAIModel({ modelName: 'offline-fake', authorizeSpend: async () => 0.01, maxOutputTokens: 256, modelProvider: fake.provider });
    const result = await model.propose({ ...input(), maxTurns: 2 });
    expect(result.itemId).toBe('item-1');
    expect(fake.calls).toBe(2);
    expect(fake.requests.every((request) => request.modelSettings.maxTokens === 256 && request.tracing === false)).toBe(true);
    expect(JSON.stringify(fake.requests[1]?.input)).toContain('Synthetic shaker');
  });

  it('validates direct adapter inputs and authorization before any model invocation', async () => {
    const fake = fakeProvider('direct');
    let authorizations = 0;
    const model = createOpenAIModel({ modelName: 'offline-fake', authorizeSpend: async () => { authorizations += 1; return 0; }, modelProvider: fake.provider });
    await expect(model.propose({ ...input(), maxTurns: Number.NaN })).rejects.toThrow();
    const getterListing = Object.defineProperty({}, 'itemId', { enumerable: true, get() { throw new Error('getter executed'); } });
    await expect(model.propose({ ...input(), listings: [getterListing] as never })).rejects.toThrow();
    expect(authorizations).toBe(0);
    expect(fake.calls).toBe(0);
  });

  it('checks abort state again after asynchronous authorization', async () => {
    const fake = fakeProvider('direct');
    const controller = new AbortController();
    let release: ((value: number) => void) | undefined;
    const model = createOpenAIModel({ modelName: 'offline-fake', authorizeSpend: () => new Promise((resolve) => { release = resolve; }), modelProvider: fake.provider });
    const pending = model.propose(input(controller.signal));
    await Promise.resolve();
    controller.abort();
    release?.(0.01);
    await expect(pending).rejects.toThrow('aborted');
    expect(fake.calls).toBe(0);
  });
});
