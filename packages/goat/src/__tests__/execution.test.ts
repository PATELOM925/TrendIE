import type { WalletCallOptions } from '@goatnetwork/agentkit/core';
import { describe, expect, it } from 'vitest';
import type { Hash } from 'viem';
import { proposalFingerprint, type PurchaseProposal } from '@trendie/contracts';
import { createGoatExecutionAdapter, GOAT_NATIVE_SCALE, GOAT_TESTNET_CHAIN_ID, type GoatAdapterOptions, type GoatBinding, type GoatGatewayAuthority, type GoatRpc, type GoatSigner, type GoatSpendAuthorization } from '../index.js';

const txHash = `0x${'1'.repeat(64)}` as const;
const proposal: PurchaseProposal = {
  version: 1, ownerId: 'owner-1', intentId: 'intent-1', intentVersion: 1, platform: 'goat',
  itemId: 'native-transfer', sellerId: 'recipient', money: { amount: '1000000000000000', scale: GOAT_NATIVE_SCALE },
  asset: 'BTC', chain: 'goat-testnet', providerArgs: { recipient: '0x000000000000000000000000000000000000dEaD' },
};
const spendAuthorization: GoatSpendAuthorization = { ownerId: proposal.ownerId, authorizationId: 'spend-auth-1', maxAmountWei: '2000000000000000' };

function makeSigner(behavior?: (to: string, amountWei: string, options?: WalletCallOptions) => Promise<{ txHash: string }>): GoatSigner {
  return {
    async getAddress() { return '0x0000000000000000000000000000000000000001'; },
    async getNetwork() { return 'goat-testnet'; },
    async getChainId() { return GOAT_TESTNET_CHAIN_ID; },
    async getBalance() { return '0'; },
    async getErc20Balance() { return '0'; },
    async transferNative(to, amountWei, options) {
      if (behavior) return behavior(to, amountWei, options);
      await options?.onSignedTransaction?.(txHash);
      await options?.onBroadcast?.(txHash);
      return { txHash };
    },
    async transferErc20() { throw new Error('unused'); },
    async approveErc20() { throw new Error('unused'); },
    async signTypedData() { throw new Error('unused'); },
    async callContract() { throw new Error('unused'); },
    async writeContract() { throw new Error('unused'); },
    async deployContract() { throw new Error('unused'); },
  };
}

type HarnessOverrides = Omit<Partial<GoatAdapterOptions>, 'rpc' | 'signer' | 'authority'> & { rpc?: Partial<GoatRpc>; signer?: GoatSigner };

function harness(overrides: HarnessOverrides = {}, authorityOverrides: Partial<GoatGatewayAuthority> = {}) {
  const calls: string[] = [];
  const outcomes: Array<{ executionId: string; status: string; providerReference?: string }> = [];
  const checkpoints: Array<{ phase: string; txHash: string }> = [];
  const fingerprint = proposalFingerprint(proposal);
  const binding: GoatBinding = {
    platform: 'goat', fingerprint, ownerId: proposal.ownerId, intentId: proposal.intentId, intentVersion: proposal.intentVersion,
    sender: '0x0000000000000000000000000000000000000001', destination: '0x000000000000000000000000000000000000dEaD',
    asset: 'BTC', chainId: GOAT_TESTNET_CHAIN_ID, amount: proposal.money.amount, scale: GOAT_NATIVE_SCALE, expiresAt: 20_000,
    spendAuthorizationId: spendAuthorization.authorizationId, spendCeilingWei: spendAuthorization.maxAmountWei,
  };
  const authority: GoatGatewayAuthority = {
    async claimExecution() { return { status: 'claimed', executionId: 'exec-1', binding }; },
    async recordSubmissionCheckpoint(input) { calls.push(input.phase); checkpoints.push(input); },
    async recordOutcome(input) { outcomes.push(input); },
    async getExecutionForReconciliation() { return { executionId: 'exec-1', ownerId: proposal.ownerId, binding, txHash, phase: 'broadcast', proposal }; },
    ...authorityOverrides,
  };
  const rpc: GoatRpc = {
    async getChainId() { calls.push('chain'); return GOAT_TESTNET_CHAIN_ID; },
    async getBlockNumber() { return 100n; },
    async getTransaction({ hash }) { return { hash, from: binding.sender, to: binding.destination, value: BigInt(proposal.money.amount), blockNumber: 99n, chainId: GOAT_TESTNET_CHAIN_ID }; },
    async getTransactionReceipt({ hash }) { return { transactionHash: hash, status: 'success', blockNumber: 99n }; },
    ...overrides.rpc,
  };
  const signer = overrides.signer ?? makeSigner(async (to, amount, options) => {
    await options?.onSignedTransaction?.(txHash);
    calls.push('send');
    await options?.onBroadcast?.(txHash);
    return { txHash };
  });
  const adapter = createGoatExecutionAdapter({
    authority, rpc, signer, numericSpendCeilingWei: overrides.numericSpendCeilingWei ?? '10000000000000000', now: overrides.now ?? (() => 10_000),
    ...(overrides.confirmations !== undefined ? { confirmations: overrides.confirmations } : {}),
    ...(overrides.executionTimeoutMs !== undefined ? { executionTimeoutMs: overrides.executionTimeoutMs } : {}),
  });
  return { adapter, calls, outcomes, checkpoints, binding, authority, rpc };
}

const input = { caller: { ownerId: proposal.ownerId }, approvalReference: 'opaque-approval', proposal, spendAuthorization };

describe('GOAT guarded native transfer', () => {
  it('persists signed and broadcast hashes before returning checked settlement', async () => {
    const h = harness();
    const result = await h.adapter.execute(input);
    expect(result.status).toBe('succeeded');
    expect(result.actual?.receiptId).toBe(txHash);
    expect(h.checkpoints.map(({ phase, txHash: hash }) => ({ phase, txHash: hash }))).toEqual([{ phase: 'signed', txHash }, { phase: 'broadcast', txHash }]);
    expect(h.outcomes.at(-1)?.status).toBe('succeeded');
  });

  it('does not broadcast when the atomic gateway claim is already consumed', async () => {
    const h = harness({}, { async claimExecution() { return { status: 'already_claimed', reason: 'ignored by adapter' }; } });
    expect((await h.adapter.execute(input)).status).toBe('blocked');
    expect(h.calls).toEqual([]);
  });

  it('keeps concurrent duplicate execution to one broadcast', async () => {
    let claimed = false;
    let broadcasts = 0;
    const h = harness({ signer: makeSigner(async (to, amount, options) => {
      await options?.onSignedTransaction?.(txHash);
      broadcasts += 1;
      await options?.onBroadcast?.(txHash);
      return { txHash };
    }) }, {
      async claimExecution() {
        if (claimed) return { status: 'already_claimed', reason: 'replayed' };
        claimed = true;
        return { status: 'claimed', executionId: 'exec-1', binding: hBinding };
      },
    });
    const results = await Promise.all([h.adapter.execute(input), h.adapter.execute(input)]);
    expect(results.map(({ status }) => status).sort()).toEqual(['blocked', 'succeeded']);
    expect(broadcasts).toBe(1);
  });

  it('requires explicit caller spend authorization and strict recipient-only arguments', async () => {
    const h = harness();
    expect((await h.adapter.execute({ ...input, spendAuthorization: { ...spendAuthorization, maxAmountWei: '0' } })).status).toBe('blocked');
    expect((await h.adapter.execute({ ...input, proposal: { ...proposal, providerArgs: { recipient: '0x000000000000000000000000000000000000dEaD', data: '0x' } } })).status).toBe('blocked');
    expect(h.calls).toEqual([]);
  });

  it('rejects expired-before-dispatch bindings and malformed or throwing claims', async () => {
    let clock = 10_000;
    const expiry = harness({ now: () => clock, rpc: { getChainId: async () => { clock = 30_000; return GOAT_TESTNET_CHAIN_ID; } } });
    expect((await expiry.adapter.execute(input)).status).toBe('blocked');
    expect(expiry.checkpoints).toHaveLength(0);
    let clockReads = 0;
    const dispatchExpiry = harness({ now: () => (++clockReads < 6 ? 10_000 : 30_000) });
    expect((await dispatchExpiry.adapter.execute(input)).status).toBe('blocked');
    expect(dispatchExpiry.checkpoints).toHaveLength(0);
    const throwing = harness({}, { async claimExecution() { throw new Error('private provider detail'); } });
    const denied = await throwing.adapter.execute(input);
    expect(denied.status).toBe('blocked');
    expect(denied.reason).not.toContain('private provider detail');
    const malformed = harness({}, { async claimExecution() { return { status: 'claimed', executionId: '', binding: hBinding }; } });
    expect((await malformed.adapter.execute(input)).status).toBe('unknown');
  });

  it('retains a signed hash on failure after signing and never retries', async () => {
    const h = harness({ signer: makeSigner(async (_to, _amount, options) => {
      await options?.onSignedTransaction?.(txHash);
      throw new Error('provider secret detail');
    }) });
    const response = await h.adapter.execute(input);
    expect(response.status).toBe('unknown');
    expect(response.providerReference).toBe(txHash);
    expect(response.reason).not.toContain('provider secret detail');
    expect(h.checkpoints.map(({ phase, txHash: hash }) => ({ phase, txHash: hash }))).toEqual([{ phase: 'signed', txHash }]);
  });

  it('returns bounded unknown after a stuck confirmation wait without retrying', async () => {
    let attempts = 0;
    const h = harness({ executionTimeoutMs: 10, signer: makeSigner(async (_to, _amount, options) => {
      attempts += 1;
      await options?.onSignedTransaction?.(txHash);
      await options?.onBroadcast?.(txHash);
      return new Promise(() => {});
    }) });
    const response = await h.adapter.execute(input);
    expect(response.status).toBe('unknown');
    expect(response.providerReference).toBe(txHash);
    expect(attempts).toBe(1);
  });

  it('does not report success when signed-checkpoint persistence fails', async () => {
    const h = harness({}, { async recordSubmissionCheckpoint() { throw new Error('db failure'); } });
    const response = await h.adapter.execute(input);
    expect(response.status).toBe('unknown');
    expect(response.providerReference).toBe(txHash);
    expect(h.calls).not.toContain('send');
  });

  it('fails closed on wrong preflight chain and returns unknown if outcome storage fails', async () => {
    const wrongChain = harness({ rpc: { async getChainId() { return 1; } } });
    expect((await wrongChain.adapter.execute(input)).status).toBe('blocked');
    expect(wrongChain.checkpoints).toHaveLength(0);
    const writeFailure = harness({}, { async recordOutcome() { throw new Error('private storage details'); } });
    const result = await writeFailure.adapter.execute(input);
    expect(result.status).toBe('unknown');
    expect(result.providerReference).toBe(txHash);
    expect(result.reason).not.toContain('private storage details');
  });

  it('preserves a conclusive reverted receipt as failed evidence', async () => {
    const h = harness({ rpc: { async getTransactionReceipt({ hash }) { return { transactionHash: hash, status: 'reverted', blockNumber: 99n }; } } });
    const result = await h.adapter.execute(input);
    expect(result.status).toBe('failed');
    expect(result.evidence).toMatchObject({ receiptStatus: 'reverted' });
  });

  it('returns unknown on RPC confirmation height failure and malformed receipt', async () => {
    const heightFailure = harness({ rpc: { async getBlockNumber() { throw new Error('down'); } } });
    expect((await heightFailure.adapter.execute(input)).status).toBe('unknown');
    const malformed = harness({ rpc: ({ async getTransactionReceipt({ hash }: { hash: Hash }) { return { transactionHash: hash, status: 'mystery', blockNumber: 99n }; } } as unknown as Partial<GoatRpc>) });
    expect((await malformed.adapter.execute(input)).status).toBe('unknown');
  });

  it('rejects wrong transaction/receipt hashes, block, sender, and chain', async () => {
    const cases: Partial<GoatRpc>[] = [
      { async getTransaction() { return { hash: `0x${'2'.repeat(64)}` as Hash, from: hSender, to: hDestination, value: BigInt(proposal.money.amount), blockNumber: 99n, chainId: GOAT_TESTNET_CHAIN_ID }; } },
      ({ async getTransactionReceipt() { return { transactionHash: `0x${'2'.repeat(64)}`, status: 'success', blockNumber: 99n }; } } as unknown as Partial<GoatRpc>),
      { async getTransactionReceipt({ hash }) { return { transactionHash: hash, status: 'success', blockNumber: 98n }; } },
      { async getTransaction({ hash }) { return { hash, from: hDestination, to: hDestination, value: BigInt(proposal.money.amount), blockNumber: 99n, chainId: GOAT_TESTNET_CHAIN_ID }; } },
      { async getTransaction({ hash }) { return { hash, from: hSender, to: hDestination, value: BigInt(proposal.money.amount), blockNumber: 99n, chainId: 1 }; } },
      { async getTransaction({ hash }) { return { hash, from: hSender, to: hDestination, value: BigInt(proposal.money.amount), blockNumber: 99n }; } },
    ];
    for (const rpc of cases) expect((await harness({ rpc }).adapter.execute(input)).status).toBe('unknown');
  });

  it('distinguishes a pending transaction from a missing transaction', async () => {
    const pending = harness({ rpc: {
      async getTransactionReceipt() { return null; },
    } });
    expect((await pending.adapter.execute(input)).status).toBe('pending');
    const missing = harness({ rpc: {
      async getTransaction() { return null; }, async getTransactionReceipt() { return null; },
    } });
    expect((await missing.adapter.execute(input)).status).toBe('unknown');
  });

  it('reconciles only through the authenticated durable execution lookup and writes outcome', async () => {
    let lookups = 0;
    const h = harness({}, { async getExecutionForReconciliation(input) {
      lookups += 1;
      if (input.callerOwnerId !== proposal.ownerId) return undefined;
      expect(input).toEqual({ callerOwnerId: proposal.ownerId, executionId: 'exec-1' });
      return { executionId: 'exec-1', ownerId: proposal.ownerId, binding: hBinding, txHash, phase: 'broadcast', proposal };
    } });
    const response = await h.adapter.reconcile({ caller: { ownerId: proposal.ownerId }, executionId: 'exec-1' });
    expect(lookups).toBe(1);
    expect(response.status).toBe('succeeded');
    expect(h.outcomes.at(-1)?.status).toBe('succeeded');
    expect((await h.adapter.reconcile({ caller: { ownerId: 'other' }, executionId: 'exec-1' })).status).toBe('blocked');
  });

  it('does not reconcile a durable record with a mismatched stored sender binding', async () => {
    const invalidBinding = { ...hBinding, sender: hDestination };
    const h = harness({}, { async getExecutionForReconciliation() { return { executionId: 'exec-1', ownerId: proposal.ownerId, binding: invalidBinding, txHash, phase: 'broadcast', proposal }; } });
    const response = await h.adapter.reconcile({ caller: { ownerId: proposal.ownerId }, executionId: 'exec-1' });
    expect(response.status).toBe('unknown');
    expect(h.outcomes.at(-1)?.status).toBe('unknown');
  });
});

const hSender = '0x0000000000000000000000000000000000000001' as const;
const hDestination = '0x000000000000000000000000000000000000dEaD' as const;
const hBinding: GoatBinding = {
  platform: 'goat', fingerprint: proposalFingerprint(proposal), ownerId: proposal.ownerId, intentId: proposal.intentId, intentVersion: proposal.intentVersion,
  sender: hSender, destination: hDestination, asset: 'BTC', chainId: GOAT_TESTNET_CHAIN_ID,
  amount: proposal.money.amount, scale: GOAT_NATIVE_SCALE, expiresAt: 20_000,
    spendAuthorizationId: spendAuthorization.authorizationId, spendCeilingWei: spendAuthorization.maxAmountWei,
};
