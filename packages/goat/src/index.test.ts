import { describe, expect, it } from 'vitest';
import { proposalFingerprint, type PurchaseProposal } from '@trendie/contracts';
import { createGoatExecutionAdapter, GOAT_NATIVE_SCALE, GOAT_TESTNET_CHAIN_ID, type GoatAdapterOptions, type GoatBinding, type GoatRpc } from './index.js';

const proposal: PurchaseProposal = {
  version: 1, ownerId: 'owner-1', intentId: 'intent-1', intentVersion: 1, platform: 'goat',
  itemId: 'native-transfer', sellerId: 'recipient', money: { amount: '1000000000000000', scale: GOAT_NATIVE_SCALE },
  asset: 'BTC', chain: 'goat-testnet', providerArgs: { recipient: '0x000000000000000000000000000000000000dEaD' },
};

function harness(overrides: Partial<GoatAdapterOptions> = {}) {
  const calls: string[] = [];
  const outcomes: Array<{ status: string; providerReference?: string }> = [];
  const fingerprint = proposalFingerprint(proposal);
  const binding: GoatBinding = {
    platform: 'goat', fingerprint, ownerId: proposal.ownerId, intentId: proposal.intentId, intentVersion: proposal.intentVersion,
    destination: '0x000000000000000000000000000000000000dEaD', asset: 'BTC', chainId: GOAT_TESTNET_CHAIN_ID,
    amount: proposal.money.amount, scale: GOAT_NATIVE_SCALE, expiresAt: 20_000,
  };
  const authority = {
    async claimExecution(input: { fingerprint: string }) {
      if (input.fingerprint !== fingerprint) return { status: 'denied' as const, reason: 'fingerprint mismatch' };
      return { status: 'claimed' as const, executionId: 'exec-1', binding };
    },
    async recordOutcome(input: { status: string; providerReference?: string }) { outcomes.push(input); },
  };
  const rpc: GoatRpc = {
    async getChainId() { calls.push('chain'); return GOAT_TESTNET_CHAIN_ID; },
    async getBlockNumber() { return 100n; },
    async getTransaction({ hash }) { return { hash, from: '0x0000000000000000000000000000000000000001', to: binding.destination, value: BigInt(proposal.money.amount), blockNumber: 99n, chainId: GOAT_TESTNET_CHAIN_ID }; },
    async getTransactionReceipt({ hash }) { return { transactionHash: hash, status: 'success', blockNumber: 99n }; },
  };
  const signer = { async transferNative() { calls.push('broadcast'); return { txHash: `0x${'1'.repeat(64)}` }; } };
  const adapter = createGoatExecutionAdapter({ authority, rpc, signer, numericSpendCeilingWei: '10000000000000000', now: () => 10_000, ...overrides });
  return { adapter, calls, outcomes, binding };
}

describe('GOAT guarded native transfer', () => {
  it('uses the AgentKit native transfer action only after authority claim and verifies a receipt', async () => {
    const { adapter, calls, outcomes } = harness();
    const result = await adapter.execute({ caller: { ownerId: proposal.ownerId }, approvalReference: 'opaque-approval', proposal });
    expect(result.status).toBe('succeeded');
    expect(result.actual?.receiptId).toMatch(/^0x/);
    expect(calls).toEqual(['chain', 'broadcast']);
    expect(outcomes.at(-1)?.status).toBe('succeeded');
  });

  it('rejects wrong caller, expired binding, or over-ceiling amount before broadcast', async () => {
    const first = harness();
    expect((await first.adapter.execute({ caller: { ownerId: 'other' }, approvalReference: 'a', proposal })).status).toBe('blocked');
    expect(first.calls).toEqual([]);
    const expired = harness({ now: () => 30_000 });
    expect((await expired.adapter.execute({ caller: { ownerId: proposal.ownerId }, approvalReference: 'a', proposal })).status).toBe('blocked');
    expect(expired.calls).toEqual([]);
    const capped = harness({ numericSpendCeilingWei: '1' });
    expect((await capped.adapter.execute({ caller: { ownerId: proposal.ownerId }, approvalReference: 'a', proposal })).status).toBe('blocked');
    expect(capped.calls).toEqual([]);
  });

  it('denies wrong chain and records ambiguous broadcast as unknown without retry', async () => {
    const chainFailure = harness({ rpc: { ...chainFailRpc, async getBlockNumber() { return 0n; } } });
    const blocked = await chainFailure.adapter.execute({ caller: { ownerId: proposal.ownerId }, approvalReference: 'a', proposal });
    expect(blocked.status).toBe('blocked');
    expect(chainFailure.calls).toEqual([]);

    const ambiguous = harness({ signer: { async transferNative() { throw new Error('timeout'); } } });
    const unknown = await ambiguous.adapter.execute({ caller: { ownerId: proposal.ownerId }, approvalReference: 'a', proposal });
    expect(unknown.status).toBe('unknown');
    expect(ambiguous.calls).toContain('chain');
  });

  it('serializes duplicate claims so only the winning execution can broadcast', async () => {
    let claimed = false;
    let broadcasts = 0;
    const base = harness();
    const h = harness({
      authority: {
        async claimExecution() {
          if (claimed) return { status: 'already_claimed', reason: 'already used' };
          claimed = true;
          return { status: 'claimed', executionId: 'exec-1', binding: base.binding };
        },
        async recordOutcome() {},
      },
      signer: { async transferNative() { broadcasts += 1; return { txHash: `0x${'2'.repeat(64)}` }; } },
    });
    const inputs = { caller: { ownerId: proposal.ownerId }, approvalReference: 'same-reference', proposal };
    const results = await Promise.all([h.adapter.execute(inputs), h.adapter.execute(inputs)]);
    expect(results.map((item) => item.status).sort()).toEqual(['blocked', 'succeeded']);
    expect(broadcasts).toBe(1);
  });

  it('keeps a mined reverted receipt failed with structured evidence', async () => {
    const h = harness({ rpc: { ...successfulRpc, async getTransactionReceipt({ hash }) { return { transactionHash: hash, status: 'reverted', blockNumber: 99n }; } } });
    const response = await h.adapter.execute({ caller: { ownerId: proposal.ownerId }, approvalReference: 'a', proposal });
    expect(response.status).toBe('failed');
    expect(response.evidence).toMatchObject({ receiptStatus: 'reverted' });
  });

  it('keeps an included but under-confirmed receipt pending and mismatched transaction unknown', async () => {
    const shallow = harness({ confirmations: 3, rpc: { ...successfulRpc, async getBlockNumber() { return 99n; } } });
    expect((await shallow.adapter.execute({ caller: { ownerId: proposal.ownerId }, approvalReference: 'a', proposal })).status).toBe('pending');
    const mismatch = harness({ rpc: { ...successfulRpc, async getTransaction({ hash }) { return { hash, from: '0x0000000000000000000000000000000000000001', to: '0x0000000000000000000000000000000000000002', value: 1n, blockNumber: 99n, chainId: GOAT_TESTNET_CHAIN_ID }; } } });
    expect((await mismatch.adapter.execute({ caller: { ownerId: proposal.ownerId }, approvalReference: 'a', proposal })).status).toBe('unknown');
  });

  it('returns unknown when outcome persistence fails after a submitted transfer', async () => {
    const h = harness({ authority: {
      async claimExecution() { return { status: 'claimed', executionId: 'exec-1', binding: hBinding }; },
      async recordOutcome() { throw new Error('storage unavailable'); },
    } });
    const response = await h.adapter.execute({ caller: { ownerId: proposal.ownerId }, approvalReference: 'a', proposal });
    expect(response.status).toBe('unknown');
    expect(response.providerReference).toMatch(/^0x/);
  });
});

const baseRpc: GoatRpc = {
  async getChainId() { return GOAT_TESTNET_CHAIN_ID; }, async getBlockNumber() { return 100n; },
  async getTransaction({ hash }) { return { hash, from: '0x0000000000000000000000000000000000000001', to: '0x000000000000000000000000000000000000dEaD', value: BigInt(proposal.money.amount), blockNumber: 99n, chainId: GOAT_TESTNET_CHAIN_ID }; },
  async getTransactionReceipt({ hash }) { return { transactionHash: hash, status: 'success', blockNumber: 99n }; },
};
const chainFailRpc: GoatRpc = { ...baseRpc, async getChainId() { return 1; } };
const successfulRpc: GoatRpc = baseRpc;
const hBinding: GoatBinding = {
  platform: 'goat', fingerprint: proposalFingerprint(proposal), ownerId: proposal.ownerId, intentId: proposal.intentId, intentVersion: proposal.intentVersion,
  destination: '0x000000000000000000000000000000000000dEaD', asset: 'BTC', chainId: GOAT_TESTNET_CHAIN_ID,
  amount: proposal.money.amount, scale: GOAT_NATIVE_SCALE, expiresAt: 20_000,
};
