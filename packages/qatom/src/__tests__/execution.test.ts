import { describe, expect, it } from 'vitest';
import { proposalFingerprint, type PaymentResult, type PurchaseProposal } from '@trendie/contracts';
import {
  createQatomExecutionAdapter,
  type ApprovedBinding,
  type GatewayAuthority,
  type QatomExecutionTransport,
} from '../execution.js';

const proposal: PurchaseProposal = {
  version: 1, ownerId: 'buyer-1', intentId: 'intent-1', intentVersion: 2,
  platform: 'qatom', itemId: 'item-1', sellerId: 'seller-1', money: { amount: '1200', scale: 3 },
  asset: 'USD-TDN', chain: 'qatom', providerArgs: { quantity: 1 },
};
const binding: ApprovedBinding = {
  executionId: 'exec-1', ownerId: proposal.ownerId, intentId: proposal.intentId,
  intentVersion: proposal.intentVersion, proposalFingerprint: '', platform: 'qatom',
  itemId: proposal.itemId, sellerId: proposal.sellerId, money: proposal.money,
  asset: proposal.asset, chain: proposal.chain, providerArgs: proposal.providerArgs,
  expiresAt: new Date(Date.now() + 60_000).toISOString(), providerReference: 'provider-approval-1',
};

function harness(options: {
  priceSupported?: boolean;
  paidAuthorized?: boolean;
  useDefaultPaidGate?: boolean;
  claim?: GatewayAuthority['claimExecution'];
  bindingOverrides?: Partial<ApprovedBinding>;
  continuationBindingOverrides?: Partial<ApprovedBinding>;
  serializeContinuation?: boolean;
  outcomeFails?: boolean;
  call?: QatomExecutionTransport['callTool'];
  toolAvailable?: boolean;
  boundArgs?: boolean;
} = {}) {
  let claims = 0;
  let calls = 0;
  let continuations = 0;
  let continuationCalls = 0;
  let continuationClaimed = false;
  const outcomes: PaymentResult[] = [];
  const authority: GatewayAuthority = {
    async claimExecution(input) {
      claims += 1;
      return options.claim ? options.claim(input) : { kind: 'claimed', binding: { ...binding, ...options.bindingOverrides, proposalFingerprint: input.fingerprint } };
    },
    async recordOutcome(_id, result) {
      outcomes.push(result);
      if (options.outcomeFails) throw new Error('simulated persistence failure');
    },
    async claimContinuation() {
      continuations += 1;
      if (options.serializeContinuation && continuationClaimed) return { kind: 'already_claimed' };
      continuationClaimed = true;
      return { kind: 'claimed', binding: { ...binding, ...options.continuationBindingOverrides, proposalFingerprint: proposalFingerprint(proposal) } };
    },
  };
  const transport: QatomExecutionTransport = {
    async listTools() { return options.toolAvailable === false ? [] : [{ name: 'agent_checkout', inputSchema: { type: 'object' } }]; },
    async callTool(name, args) { calls += 1; return options.call ? options.call(name, args) : receipt(); },
    async continueTool() { continuationCalls += 1; return receipt(); },
  };
  const paidGate = options.useDefaultPaidGate ? {} : { paidExecution: { async isAuthorized() { return options.paidAuthorized ?? true; } } };
  const adapter = createQatomExecutionAdapter({
    authority, transport,
    boundPrice: {
      async supportsAtomicPriceBound() { return options.priceSupported ?? true; },
      async prepareBoundCall({ binding: approved }) { return options.boundArgs === false ? undefined : { args: { ...approved.providerArgs, bound: approved.money.amount } }; },
    },
    ...paidGate,
    receiptVerifier: {
      async assess({ response }) {
        if (!response || typeof response !== 'object' || !('structuredContent' in response)) return { status: 'unknown' as const };
        const data = response.structuredContent;
        if (!data || typeof data !== 'object') return { status: 'unknown' as const };
        const fields = data as Record<string, unknown>;
        if (fields.approval_required === true) return typeof fields.provider_reference === 'string'
          ? { status: 'pending_approval' as const, providerReference: fields.provider_reference }
          : { status: 'unknown' as const };
        if (fields.terminal_failure === true) return { status: 'failed' as const, terminalEvidence: fields.terminal_evidence as { [key: string]: import('@trendie/contracts').JsonValue } };
        if (typeof fields.transaction_id !== 'string' || typeof fields.item_id !== 'string' || typeof fields.amount !== 'string' || typeof fields.scale !== 'number') return { status: 'unknown' as const };
        return {
          status: fields.settled === true ? 'succeeded' as const : 'pending' as const,
          providerReference: fields.transaction_id,
          actual: { itemId: fields.item_id, money: { amount: fields.amount, scale: fields.scale }, receiptId: fields.transaction_id },
        };
      },
    },
    checkoutToolName: 'agent_checkout',
  });
  return { adapter, outcomes, get claims() { return claims; }, get calls() { return calls; }, get continuations() { return continuations; }, get continuationCalls() { return continuationCalls; } };
}

function receipt(extra: Record<string, unknown> = {}) {
  return { structuredContent: { transaction_id: 'tx-1', item_id: 'item-1', amount: '1200', scale: 3, settled: true, ...extra } };
}

describe('guarded Qatom execution adapter', () => {
  it('keeps paid execution disabled when no numeric authorization is configured', async () => {
    const h = harness({ useDefaultPaidGate: true });
    const result = await h.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal });
    expect(result.status).toBe('blocked');
    expect(h.claims).toBe(0);
    expect(h.calls).toBe(0);
  });

  it('rejects an owner mismatch before tool discovery or authority claim', async () => {
    const h = harness();
    const result = await h.adapter.execute({ caller: { ownerId: 'buyer-2' }, approvalReference: 'opaque', proposal });
    expect(result.status).toBe('blocked');
    expect(h.claims).toBe(0);
    expect(h.calls).toBe(0);
  });

  it('blocks before claiming or calling when atomic price binding is unavailable', async () => {
    const h = harness({ priceSupported: false });
    const result = await h.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal });
    expect(result.status).toBe('blocked');
    expect(h.claims).toBe(0);
    expect(h.calls).toBe(0);
  });

  it('honors authority denial before provider dispatch', async () => {
    const h = harness({ claim: async () => ({ kind: 'denied', reason: 'expired or mismatched' }) });
    const result = await h.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal });
    expect(result.status).toBe('blocked');
    expect(h.calls).toBe(0);
  });

  it('blocks unavailable tools and unpreparable bound arguments without provider dispatch', async () => {
    const missing = harness({ toolAvailable: false });
    expect((await missing.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal })).status).toBe('blocked');
    expect(missing.claims).toBe(0);
    const unprepared = harness({ boundArgs: false });
    expect((await unprepared.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal })).status).toBe('blocked');
    expect(unprepared.calls).toBe(0);
  });

  it('rejects changed seller, item, amount, asset, and provider arguments when authority denies the binding', async () => {
    const variants: PurchaseProposal[] = [
      { ...proposal, sellerId: 'seller-2' },
      { ...proposal, itemId: 'item-2' },
      { ...proposal, money: { amount: '1201', scale: 3 } },
      { ...proposal, providerArgs: { quantity: 2 } },
    ];
    for (const changed of variants) {
      const h = harness({ claim: async () => ({ kind: 'denied', reason: 'approved proposal differs' }) });
      const result = await h.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal: changed });
      expect(result.status).toBe('blocked');
      expect(h.calls).toBe(0);
    }
    const invalidAsset = harness();
    await expect(invalidAsset.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal: { ...proposal, asset: 'OTHER' } })).rejects.toThrow();
    expect(invalidAsset.calls).toBe(0);
  });

  it('rejects an expired binding and a claimed binding that differs from the proposal', async () => {
    const expired = harness({ bindingOverrides: { expiresAt: new Date(Date.now() - 1_000).toISOString() } });
    expect((await expired.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal })).status).toBe('blocked');
    expect(expired.calls).toBe(0);
    const mismatched = harness({ bindingOverrides: { sellerId: 'seller-elsewhere' } });
    expect((await mismatched.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal })).status).toBe('blocked');
    expect(mismatched.calls).toBe(0);
  });

  it('blocks another platform and malformed proposal values before provider interaction', async () => {
    const h = harness();
    const goat = { ...proposal, platform: 'goat' as const };
    expect((await h.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal: goat })).status).toBe('blocked');
    expect(h.calls).toBe(0);
    await expect(h.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal: { ...proposal, money: { amount: 1.2, scale: 3 } } as unknown as PurchaseProposal })).rejects.toThrow();
    expect(h.calls).toBe(0);
  });

  it('checks the provider receipt and records verified settlement', async () => {
    const h = harness();
    const result = await h.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal });
    expect(result).toMatchObject({ executionId: 'exec-1', status: 'succeeded', actual: { itemId: 'item-1', money: proposal.money, receiptId: 'tx-1' } });
    expect(h.outcomes).toHaveLength(1);
  });

  it('keeps receipt mismatches, malformed outcomes, and possible-dispatch errors unknown', async () => {
    const mismatch = harness({ call: async () => receipt({ amount: '1300' }) });
    expect((await mismatch.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal })).status).toBe('unknown');
    const malformed = harness({ call: async () => ({ isError: true, content: [{ type: 'text', text: 'do not trust' }] }) });
    expect((await malformed.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal })).status).toBe('unknown');
    const timeout = harness({ call: async () => { throw new Error('timeout'); } });
    expect((await timeout.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal })).status).toBe('unknown');
    const missingReceipt = harness({ call: async () => ({ structuredContent: { item_id: 'item-1', amount: '1200', scale: 3, settled: true } }) });
    expect((await missingReceipt.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal })).status).toBe('unknown');
    const unsupportedFailure = harness({ call: async () => ({ structuredContent: { terminal_failure: true, terminal_evidence: 'not-object' } }) });
    expect((await unsupportedFailure.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal })).status).toBe('unknown');
    const verifiedFailure = harness({ call: async () => ({ structuredContent: { terminal_failure: true, terminal_evidence: { terminal: true, code: 'DECLINED' } } }) });
    expect(await verifiedFailure.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal })).toMatchObject({ status: 'failed', evidence: { terminal: true } });
  });

  it('does not turn an outcome persistence error into success', async () => {
    const h = harness({ outcomeFails: true });
    expect((await h.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal })).status).toBe('unknown');
  });

  it('serializes concurrent claims through the authority port', async () => {
    let used = false;
    const h = harness({ claim: async (input) => {
      if (used) return { kind: 'already_claimed', executionId: 'exec-1' };
      used = true;
      return { kind: 'claimed', binding: { ...binding, proposalFingerprint: input.fingerprint } };
    } });
    const run = () => h.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal });
    const results = await Promise.all([run(), run()]);
    expect(h.calls).toBe(1);
    expect(results.filter((r) => r.status === 'succeeded')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'blocked')).toHaveLength(1);
  });

  it('keeps provider human approval pending and claims continuation under the same execution id', async () => {
    const h = harness({ call: async () => ({ structuredContent: { approval_required: true, provider_reference: 'provider-approval-1' } }) });
    const pending = await h.adapter.execute({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', proposal });
    expect(pending).toMatchObject({ executionId: 'exec-1', status: 'pending_approval', providerReference: 'provider-approval-1' });
    const continued = await h.adapter.continue({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', executionId: 'exec-1', providerReference: 'provider-approval-1' });
    expect(continued).toMatchObject({ executionId: 'exec-1', status: 'succeeded' });
    expect(h.claims).toBe(1);
    expect(h.continuations).toBe(1);
  });

  it('denies continuation before provider dispatch when authorization is revoked or price binding is unsupported', async () => {
    const revoked = harness({ paidAuthorized: false });
    expect((await revoked.adapter.continue({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', executionId: 'exec-1', providerReference: 'provider-approval-1' })).status).toBe('blocked');
    expect(revoked.continuations).toBe(1);
    expect(revoked.calls).toBe(0);
    const unsupported = harness({ priceSupported: false });
    expect((await unsupported.adapter.continue({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', executionId: 'exec-1', providerReference: 'provider-approval-1' })).status).toBe('blocked');
    expect(unsupported.calls).toBe(0);
    const defaultDenied = harness({ useDefaultPaidGate: true });
    expect((await defaultDenied.adapter.continue({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', executionId: 'exec-1', providerReference: 'provider-approval-1' })).status).toBe('blocked');
    expect(defaultDenied.continuations).toBe(0);
    expect(defaultDenied.calls).toBe(0);
  });

  it('rejects a continuation with altered persisted reference, owner, expiry, or execution identity', async () => {
    const variants: Partial<ApprovedBinding>[] = [
      { providerReference: 'another-reference' }, { ownerId: 'another-owner' },
      { expiresAt: new Date(Date.now() - 1_000).toISOString() }, { executionId: 'another-execution' },
    ];
    for (const continuationBindingOverrides of variants) {
      const h = harness({ continuationBindingOverrides });
      const result = await h.adapter.continue({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', executionId: 'exec-1', providerReference: 'provider-approval-1' });
      expect(result.status).toBe('blocked');
      expect(h.continuations).toBe(1);
      expect(h.calls).toBe(0);
    }
  });

  it('serializes concurrent continuation claims to one provider dispatch', async () => {
    const h = harness({ serializeContinuation: true });
    const run = () => h.adapter.continue({ caller: { ownerId: 'buyer-1' }, approvalReference: 'opaque', executionId: 'exec-1', providerReference: 'provider-approval-1' });
    const results = await Promise.all([run(), run()]);
    expect(h.continuationCalls).toBe(1);
    expect(results.filter((result) => result.status === 'succeeded')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'blocked')).toHaveLength(1);
  });
});
