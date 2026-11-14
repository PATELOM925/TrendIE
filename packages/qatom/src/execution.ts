import {
  parseProposal,
  MoneySchema,
  PaymentResultSchema,
  canonicalJson,
  proposalFingerprint,
  type JsonValue,
  type PaymentResult,
  type PurchaseProposal,
} from '@trendie/contracts';

export interface TrustedCaller { ownerId: string }

export interface ApprovedBinding {
  executionId: string;
  ownerId: string;
  intentId: string;
  intentVersion: number;
  proposalFingerprint: string;
  providerReference?: string;
  platform: 'qatom';
  itemId: string;
  sellerId: string;
  money: PurchaseProposal['money'];
  asset: string;
  chain: string;
  providerArgs: Record<string, JsonValue>;
  expiresAt: string;
}

export type ClaimResult =
  | { kind: 'claimed'; binding: ApprovedBinding }
  | { kind: 'denied'; reason: string }
  | { kind: 'already_claimed'; executionId: string };

export interface GatewayAuthority {
  claimExecution(input: {
    caller: TrustedCaller;
    approvalReference: string;
    proposal: PurchaseProposal;
    fingerprint: string;
  }): Promise<ClaimResult>;
  recordOutcome(executionId: string, result: PaymentResult): Promise<void>;
  claimContinuation(input: {
    caller: TrustedCaller;
    approvalReference: string;
    executionId: string;
    providerReference: string;
  }): Promise<{ kind: 'claimed'; binding: ApprovedBinding } | { kind: 'denied'; reason: string } | { kind: 'already_claimed' }>;
}

export interface BoundCheckoutCapability {
  supportsAtomicPriceBound(input: { toolName: string; toolSchema: unknown }): Promise<boolean>;
  prepareBoundCall(input: {
    toolName: string;
    toolSchema: unknown;
    binding: ApprovedBinding;
  }): Promise<{ args: Record<string, unknown> } | undefined>;
}

export interface PaidExecutionGate {
  isAuthorized(input: { caller: TrustedCaller; approvalReference: string; proposal: PurchaseProposal }): Promise<boolean>;
}

export const disabledPaidExecution: PaidExecutionGate = { async isAuthorized() { return false; } };

export interface QatomExecutionTransport {
  listTools(): Promise<{ name: string; inputSchema: unknown }[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  continueTool(providerReference: string): Promise<unknown>;
}

export type ReceiptAssessment =
  | { status: 'succeeded'; actual: NonNullable<PaymentResult['actual']>; providerReference?: string }
  | { status: 'failed'; terminalEvidence: JsonValue }
  | { status: 'pending_approval'; providerReference: string }
  | { status: 'pending' | 'unknown'; providerReference?: string; actual?: PaymentResult['actual'] };

export interface QatomReceiptVerifier {
  assess(input: { response: unknown; binding: ApprovedBinding; proposal?: PurchaseProposal }): Promise<ReceiptAssessment>;
}

export interface QatomExecutionAdapter {
  execute(input: {
    caller: TrustedCaller;
    approvalReference: string;
    proposal: PurchaseProposal;
  }): Promise<PaymentResult>;
  continue(input: {
    caller: TrustedCaller;
    approvalReference: string;
    executionId: string;
    providerReference: string;
  }): Promise<PaymentResult>;
}

export function createQatomExecutionAdapter(deps: {
  authority: GatewayAuthority;
  transport: QatomExecutionTransport;
  boundPrice: BoundCheckoutCapability;
  paidExecution?: PaidExecutionGate;
  receiptVerifier: QatomReceiptVerifier;
  checkoutToolName: string;
  now?: () => number;
}): QatomExecutionAdapter {
  const persist = async (result: PaymentResult): Promise<PaymentResult> => {
    try {
      const checked = PaymentResultSchema.parse(result);
      await deps.authority.recordOutcome(checked.executionId, checked);
      return checked;
    } catch {
      return { executionId: typeof result.executionId === 'string' ? result.executionId.slice(0, 256) : '', platform: 'qatom', status: 'unknown', reason: 'Outcome persistence failed or result was invalid; reconcile before retry' };
    }
  };
  const paidExecution = deps.paidExecution ?? disabledPaidExecution;
  const now = deps.now ?? Date.now;

  return {
    async execute(input) {
      const proposal = parseProposal(input.proposal);
      if (proposal.platform !== 'qatom') return { executionId: '', platform: 'qatom', status: 'blocked', reason: 'Proposal platform is not Qatom' };
      if (proposal.ownerId !== input.caller.ownerId) return { executionId: '', platform: 'qatom', status: 'blocked', reason: 'Trusted caller does not match proposal owner' };
      let tools: Awaited<ReturnType<QatomExecutionTransport['listTools']>>;
      try { tools = await deps.transport.listTools(); }
      catch { return { executionId: '', platform: 'qatom', status: 'blocked', reason: 'Checkout tool discovery failed' }; }
      const tool = tools.find((candidate) => candidate.name === deps.checkoutToolName);
      if (!tool) return { executionId: '', platform: 'qatom', status: 'blocked', reason: 'Checkout tool is unavailable' };
      let paidAllowed = false;
      try { paidAllowed = await paidExecution.isAuthorized({ caller: input.caller, approvalReference: input.approvalReference, proposal }); }
      catch { paidAllowed = false; }
      if (!paidAllowed) {
        return { executionId: '', platform: 'qatom', status: 'blocked', reason: 'Paid execution is disabled or lacks a numeric spend authorization' };
      }
      let hasPriceBound = false;
      try { hasPriceBound = await deps.boundPrice.supportsAtomicPriceBound({ toolName: tool.name, toolSchema: tool.inputSchema }); }
      catch { hasPriceBound = false; }
      if (!hasPriceBound) {
        return { executionId: '', platform: 'qatom', status: 'blocked', reason: 'Atomic approved-price binding is unverified' };
      }
      const fingerprint = proposalFingerprint(proposal);
      let claim: ClaimResult;
      try { claim = await deps.authority.claimExecution({ ...input, proposal, fingerprint }); }
      catch { return { executionId: '', platform: 'qatom', status: 'blocked', reason: 'Gateway authority could not claim execution' }; }
      if (!claim || !['claimed', 'denied', 'already_claimed'].includes((claim as ClaimResult).kind)) return { executionId: '', platform: 'qatom', status: 'blocked', reason: 'Gateway authority returned an invalid claim' };
      if (claim.kind !== 'claimed') {
        return { executionId: claim.kind === 'already_claimed' ? claim.executionId : '', platform: 'qatom', status: 'blocked', reason: claim.kind === 'denied' ? 'Gateway authority denied or rejected this approval' : 'Execution already claimed' };
      }
      const binding = claim.binding;
      if (!validBinding(binding, input.caller, proposal, fingerprint, now())) {
        return persist({ executionId: binding.executionId, platform: 'qatom', status: 'blocked', reason: 'Authority returned a mismatched execution binding' });
      }
      let boundCall: { args: Record<string, unknown> } | undefined;
      try { boundCall = await deps.boundPrice.prepareBoundCall({ toolName: tool.name, toolSchema: tool.inputSchema, binding }); }
      catch { return persist({ executionId: binding.executionId, platform: 'qatom', status: 'blocked', reason: 'Bound checkout arguments could not be prepared' }); }
      if (!boundCall) return persist({ executionId: binding.executionId, platform: 'qatom', status: 'blocked', reason: 'Atomic approved-price binding is unverified' });
      if (!validBinding(binding, input.caller, proposal, fingerprint, now())) return persist({ executionId: binding.executionId, platform: 'qatom', status: 'blocked', reason: 'Execution binding expired before dispatch' });
      let response: unknown;
      try {
        response = await deps.transport.callTool(tool.name, boundCall.args);
      } catch {
        return persist({ executionId: binding.executionId, platform: 'qatom', status: 'unknown', reason: 'Provider call outcome is uncertain' });
      }
      return persist(await assessProviderResult(deps.receiptVerifier, response, binding, proposal));
    },
    async continue(input) {
      let claim: Awaited<ReturnType<GatewayAuthority['claimContinuation']>>;
      try { claim = await deps.authority.claimContinuation(input); }
      catch { return { executionId: input.executionId, platform: 'qatom', status: 'blocked', reason: 'Gateway authority could not claim continuation' }; }
      if (!claim || !['claimed', 'denied', 'already_claimed'].includes((claim as typeof claim).kind)) return { executionId: input.executionId, platform: 'qatom', status: 'blocked', reason: 'Gateway authority returned an invalid continuation claim' };
      if (claim.kind !== 'claimed') return { executionId: input.executionId, platform: 'qatom', status: 'blocked', reason: claim.kind === 'denied' ? 'Gateway authority denied this continuation' : 'Continuation already claimed' };
      const binding = claim.binding;
      let expected: PurchaseProposal;
      let fingerprint: string;
      try { expected = proposalFromBinding(binding); fingerprint = proposalFingerprint(expected); }
      catch { return persist({ executionId: input.executionId, platform: 'qatom', status: 'blocked', reason: 'Continuation binding is invalid' }); }
      if (!validBinding(binding, input.caller, expected, fingerprint, now()) || binding.executionId !== input.executionId || binding.providerReference !== input.providerReference) {
        return persist({ executionId: input.executionId, platform: 'qatom', status: 'blocked', reason: 'Continuation binding mismatch' });
      }
      if (binding.proposalFingerprint !== fingerprint) return persist({ executionId: input.executionId, platform: 'qatom', status: 'blocked', reason: 'Continuation proposal fingerprint mismatch' });
      let tools: Awaited<ReturnType<QatomExecutionTransport['listTools']>>;
      try { tools = await deps.transport.listTools(); } catch { return persist({ executionId: input.executionId, platform: 'qatom', status: 'blocked', reason: 'Checkout tool discovery failed' }); }
      const tool = tools.find((candidate) => candidate.name === deps.checkoutToolName);
      if (!tool) return persist({ executionId: input.executionId, platform: 'qatom', status: 'blocked', reason: 'Checkout tool is unavailable' });
      let paidAllowed = false;
      try { paidAllowed = await paidExecution.isAuthorized({ caller: input.caller, approvalReference: input.approvalReference, proposal: expected }); } catch { paidAllowed = false; }
      if (!paidAllowed) return persist({ executionId: input.executionId, platform: 'qatom', status: 'blocked', reason: 'Paid execution is disabled or lacks a numeric spend authorization' });
      let hasPriceBound = false;
      try { hasPriceBound = await deps.boundPrice.supportsAtomicPriceBound({ toolName: tool.name, toolSchema: tool.inputSchema }); } catch { hasPriceBound = false; }
      if (!hasPriceBound) return persist({ executionId: input.executionId, platform: 'qatom', status: 'blocked', reason: 'Atomic approved-price binding is unverified' });
      if (!validBinding(binding, input.caller, expected, fingerprint, now())) return persist({ executionId: input.executionId, platform: 'qatom', status: 'blocked', reason: 'Continuation binding expired before dispatch' });
      let response: unknown;
      try { response = await deps.transport.continueTool(input.providerReference); }
      catch { return persist({ executionId: input.executionId, platform: 'qatom', status: 'unknown', reason: 'Continuation outcome is uncertain' }); }
      return persist(await assessProviderResult(deps.receiptVerifier, response, claim.binding, expected));
    },
  };
}

async function assessProviderResult(verifier: QatomReceiptVerifier, response: unknown, binding: ApprovedBinding, proposal: PurchaseProposal): Promise<PaymentResult> {
  const executionId = binding.executionId;
  if (!response || typeof response !== 'object') return { executionId, platform: 'qatom', status: 'unknown', reason: 'Provider response is malformed' };
  if (response && typeof response === 'object' && 'isError' in response && response.isError === true) {
    return { executionId, platform: 'qatom', status: 'unknown', reason: 'Provider returned a tool error after dispatch' };
  }
  try {
    const resultData = response as Record<string, unknown>;
    if (Array.isArray(resultData.content) && (resultData.content.length > 50 || resultData.content.some((part) => part && typeof part === 'object' && 'text' in part && typeof (part as Record<string, unknown>).text === 'string' && Buffer.byteLength((part as Record<string, string>).text ?? '', 'utf8') > 32_000))) {
      return { executionId, platform: 'qatom', status: 'unknown', reason: 'Provider response exceeds limits' };
    }
    if (Buffer.byteLength(JSON.stringify(response), 'utf8') > 64_000) return { executionId, platform: 'qatom', status: 'unknown', reason: 'Provider response exceeds limits' };
    const assessment = await verifier.assess({ response, binding, proposal });
    if (!['pending_approval', 'pending', 'succeeded', 'failed', 'unknown'].includes(assessment.status)) {
      return { executionId, platform: 'qatom', status: 'unknown', reason: 'Receipt verifier returned an unsupported status' };
    }
    const actual = assessment.status === 'failed' || assessment.status === 'pending_approval' ? undefined : validateActual(assessment.actual);
    if (assessment.status === 'succeeded' && (!actual?.receiptId || !actual.itemId || !actual.money)) {
      return { executionId, platform: 'qatom', status: 'unknown', reason: 'Verified success is missing checked receipt evidence' };
    }
    if (actual && (actual.itemId !== proposal.itemId || actual.money.amount !== proposal.money.amount || actual.money.scale !== proposal.money.scale)) {
      return { executionId, platform: 'qatom', status: 'unknown', ...safeReference(assessment), actual, reason: 'Receipt does not match approved item or amount' };
    }
    if (assessment.status === 'failed') {
      try {
        if (!assessment.terminalEvidence || typeof assessment.terminalEvidence !== 'object' || Array.isArray(assessment.terminalEvidence)) throw new TypeError('Terminal evidence must be an object');
        canonicalJson(assessment.terminalEvidence);
        return { executionId, platform: 'qatom', status: 'failed', evidence: assessment.terminalEvidence };
      } catch {
        return { executionId, platform: 'qatom', status: 'unknown', reason: 'Terminal failure evidence is invalid' };
      }
    }
    if (assessment.status === 'pending_approval' && !validReference(assessment.providerReference)) {
      return { executionId, platform: 'qatom', status: 'unknown', reason: 'Provider approval continuation reference is missing or invalid' };
    }
    const result: PaymentResult = { executionId, platform: 'qatom', status: assessment.status };
    if ('providerReference' in assessment && validReference(assessment.providerReference)) result.providerReference = assessment.providerReference;
    if (actual) result.actual = actual;
    return result;
  } catch {
    return { executionId, platform: 'qatom', status: 'unknown', reason: 'Receipt could not be safely verified' };
  }
}

function proposalFromBinding(binding: ApprovedBinding): PurchaseProposal {
  return parseProposal({ version: 1, ownerId: binding.ownerId, intentId: binding.intentId, intentVersion: binding.intentVersion, platform: binding.platform, itemId: binding.itemId, sellerId: binding.sellerId, money: binding.money, asset: binding.asset, chain: binding.chain, providerArgs: binding.providerArgs });
}

function validBinding(binding: ApprovedBinding, caller: TrustedCaller, proposal: PurchaseProposal, fingerprint: string, now: number): boolean {
  try {
    return !!binding && typeof binding.executionId === 'string' && binding.executionId.length > 0 && binding.executionId.length <= 256 && binding.ownerId === caller.ownerId && binding.intentId === proposal.intentId && binding.intentVersion === proposal.intentVersion && binding.platform === 'qatom' && binding.proposalFingerprint === fingerprint && binding.itemId === proposal.itemId && binding.sellerId === proposal.sellerId && canonicalJson(binding.money) === canonicalJson(proposal.money) && binding.asset === proposal.asset && binding.chain === proposal.chain && canonicalJson(binding.providerArgs) === canonicalJson(proposal.providerArgs) && Number.isFinite(Date.parse(binding.expiresAt)) && Date.parse(binding.expiresAt) > now;
  } catch { return false; }
}

function validReference(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\r\n]/.test(value);
}

function safeReference(assessment: ReceiptAssessment): { providerReference?: string } {
  return 'providerReference' in assessment && validReference(assessment.providerReference) ? { providerReference: assessment.providerReference } : {};
}

function validateActual(value: PaymentResult['actual']): PaymentResult['actual'] | undefined {
  if (!value || typeof value.itemId !== 'string' || value.itemId.length === 0 || value.itemId.length > 512) return undefined;
  const money = MoneySchema.safeParse(value.money);
  if (!money.success) return undefined;
  if (value.receiptId !== undefined && (typeof value.receiptId !== 'string' || value.receiptId.length === 0 || value.receiptId.length > 512)) return undefined;
  return { itemId: value.itemId, money: money.data, ...(value.receiptId ? { receiptId: value.receiptId } : {}) };
}
