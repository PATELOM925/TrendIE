import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ agent: undefined as { model?: string; toolUseBehavior?: string; outputType?: unknown; tools?: Array<{ execute: (args: unknown) => Promise<unknown> }> } | undefined, run: vi.fn() }));
vi.mock('@openai/agents', () => ({
  Agent: class { constructor(config: unknown) { state.agent = config as typeof state.agent; Object.assign(this, config); } },
  run: state.run,
  tool: (config: unknown) => config,
}));

import { createOpenAIModel } from '../openai.js';

describe('OpenAI adapter controls', () => {
  beforeEach(() => { state.agent = undefined; state.run.mockReset(); process.env.OPENAI_API_KEY = 'test-key'; });

  it('requires explicit model and async authorization; denial performs no run', async () => {
    expect(() => createOpenAIModel({ modelName: '', authorizeSpend: async () => 1 })).toThrow();
    const model = createOpenAIModel({ modelName: 'test-model', authorizeSpend: async () => 0 });
    await expect(model.propose({ task: 'task', listings: [], signal: new AbortController().signal, maxTurns: 1, maxToolCalls: 1 })).rejects.toThrow('not authorized');
    expect(state.run).not.toHaveBeenCalled();
  });

  it('uses explicit structured proposal output and requested turn bound', async () => {
    state.run.mockResolvedValue({ finalOutput: { itemId: 'i', sellerId: 's', money: { amount: '1', scale: 3 }, asset: 'USD-TDN', providerArgs: {} } });
    const model = createOpenAIModel({ modelName: 'test-model', authorizeSpend: async () => 0.01 });
    const result = await model.propose({ task: 'task', listings: [], signal: new AbortController().signal, maxTurns: 2, maxToolCalls: 1 });
    expect(result).toMatchObject({ itemId: 'i', sellerId: 's', money: { amount: '1' } });
    expect(state.agent).toMatchObject({ model: 'test-model', toolUseBehavior: 'run_llm_again' });
    expect(state.agent.outputType).toBeDefined();
    expect(state.run.mock.calls[0]?.[2]).toMatchObject({ maxTurns: 2 });
  });

  it('rejects listing tool calls beyond the caller bound', async () => {
    state.run.mockImplementation(async (agent: { tools: Array<{ execute: (args: unknown) => Promise<unknown> }> }) => {
      await agent.tools[0].execute({});
      await expect(agent.tools[0].execute({})).rejects.toThrow('Tool call limit exceeded');
      return { finalOutput: { itemId: 'i', sellerId: 's', money: { amount: '1', scale: 3 }, asset: 'USD-TDN', providerArgs: {} } };
    });
    const model = createOpenAIModel({ modelName: 'test-model', authorizeSpend: async () => 0.01 });
    await expect(model.propose({ task: 'task', listings: [], signal: new AbortController().signal, maxTurns: 3, maxToolCalls: 1 })).resolves.toBeDefined();
  });
});
