import { ExecutionRuntime, PolicyEngine, ViemWalletProvider, type WalletCallOptions, type WalletProvider } from '@goatnetwork/agentkit/core';
import { transferNativeAction } from '@goatnetwork/agentkit/plugins';
import { PurchaseProposalSchema, proposalFingerprint, type JsonValue, type PaymentResult, type PurchaseProposal } from '@trendie/contracts';
import { createPublicClient, http, type Chain, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { GoatProviderArgsSchema, bindingMatches, parseAddress, parseHash, parseWei, reconciliationBindingMatches, result, verifyReceipt } from './verification.js';
import { GOAT_NATIVE_ASSET, GOAT_NATIVE_SCALE, GOAT_TESTNET_CHAIN_ID, GOAT_TESTNET_RPC_URL, type GoatAdapterOptions, type GoatGatewayAuthority, type GoatPaymentResult, type GoatRpc, type GoatSigner, type GoatExecutionInput } from './types.js';

const GOAT_CHAIN: Chain = {
  id: GOAT_TESTNET_CHAIN_ID,
  name: 'goat-testnet',
  nativeCurrency: { name: 'BTC', symbol: 'BTC', decimals: GOAT_NATIVE_SCALE },
  rpcUrls: { default: { http: [GOAT_TESTNET_RPC_URL] } },
};
const DEFAULT_EXECUTION_TIMEOUT_MS = 120_000;

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && value.trim() === value;
}

function safeResult(executionId: string, status: PaymentResult['status'], reason: string, providerReference?: string): PaymentResult {
  return result({ executionId, status, platform: 'goat', reason, ...(providerReference ? { providerReference } : {}) });
}

function checkpointingSigner(signer: GoatSigner, authority: GoatGatewayAuthority, executionId: string, retainHash: (hash: Hash, phase: 'signed' | 'broadcast') => void, assertDispatch: (signal?: AbortSignal) => Promise<void>): WalletProvider {
  return new Proxy(signer, {
    get(target, property) {
      if (property !== 'transferNative') {
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return async (to: string, amountWei: string, options?: WalletCallOptions) => {
        await assertDispatch(options?.signal);
        if (options?.signal?.aborted) throw new Error('Execution was interrupted before dispatch');
        return target.transferNative(to, amountWei, {
        ...options,
        onSignedTransaction: async (value) => {
          const hash = parseHash(value);
          if (!hash) throw new Error('Invalid signed transaction hash');
          retainHash(hash, 'signed');
          await authority.recordSubmissionCheckpoint({ executionId, phase: 'signed', txHash: hash });
          await assertDispatch(options?.signal);
          if (options?.signal?.aborted) throw new Error('Execution was interrupted before dispatch');
          await options?.onSignedTransaction?.(hash);
        },
        onBroadcast: async (value) => {
          const hash = parseHash(value);
          if (!hash) throw new Error('Invalid broadcast transaction hash');
          retainHash(hash, 'broadcast');
          await authority.recordSubmissionCheckpoint({ executionId, phase: 'broadcast', txHash: hash });
          await options?.onBroadcast?.(hash);
        },
        });
      };
    },
  });
}

async function persistOutcome(authority: GoatGatewayAuthority, executionId: string, status: 'blocked' | 'pending' | 'succeeded' | 'failed' | 'unknown', fields: { providerReference?: Hash; reason?: string; evidence?: JsonValue } = {}): Promise<PaymentResult> {
  try {
    await authority.recordOutcome({ executionId, status, ...fields });
  } catch {
    return safeResult(executionId, 'unknown', 'Outcome persistence failed; reconcile before any retry', fields.providerReference);
  }
  return result({ executionId, status, platform: 'goat', ...fields });
}

function validateSpendAuthorization(input: GoatExecutionInput, amountWei: bigint, ceiling: bigint): boolean {
  const authorization = input.spendAuthorization;
  if (!authorization || !validId(authorization.authorizationId) || authorization.ownerId !== input.caller.ownerId) return false;
  if (typeof authorization.maxAmountWei !== 'string' || authorization.maxAmountWei.length > 80 || !/^[1-9][0-9]*$/.test(authorization.maxAmountWei)) return false;
  const authorizedMaximum = BigInt(authorization.maxAmountWei);
  return authorizedMaximum > 0n && authorizedMaximum <= ceiling && amountWei <= authorizedMaximum;
}

export function createGoatExecutionAdapter(options: GoatAdapterOptions) {
  const now = options.now ?? Date.now;
  if (options.numericSpendCeilingWei.length > 80 || !/^[1-9][0-9]*$/.test(options.numericSpendCeilingWei)) throw new TypeError('A positive numeric GOAT spend ceiling in wei is required');
  const ceiling = BigInt(options.numericSpendCeilingWei);
  const confirmations = options.confirmations ?? 1;
  const timeoutMs = options.executionTimeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;
  if (!Number.isSafeInteger(confirmations) || confirmations < 1) throw new TypeError('Confirmations must be a positive integer');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) throw new TypeError('Execution timeout must be between 1 and 2147483647 milliseconds');

  return {
    async execute(input: GoatExecutionInput): Promise<GoatPaymentResult> {
      let proposal: PurchaseProposal;
      try {
        proposal = PurchaseProposalSchema.parse(input.proposal);
        if (!Number.isFinite(now())) throw new TypeError('Clock is invalid');
        if (!validId(input.caller?.ownerId) || input.caller.ownerId !== proposal.ownerId) return safeResult('', 'blocked', 'Caller owner does not match proposal owner');
        if (!validId(input.approvalReference) || proposal.platform !== 'goat') return safeResult('', 'blocked', 'GOAT approval reference or platform is invalid');
        const args = GoatProviderArgsSchema.parse(proposal.providerArgs);
        const recipient = parseAddress(args.recipient);
        if (!recipient || proposal.asset !== GOAT_NATIVE_ASSET || proposal.chain !== 'goat-testnet' || proposal.money.scale !== GOAT_NATIVE_SCALE) return safeResult('', 'blocked', 'Only native BTC recipient transfers on GOAT Testnet3 at scale 18 are supported');
        const amountWei = parseWei(proposal.money.amount, proposal.money.scale);
        if (amountWei <= 0n || amountWei > ceiling || !validateSpendAuthorization(input, amountWei, ceiling)) return safeResult('', 'blocked', 'A matching positive caller-authorized spend ceiling is required');

        const fingerprint = proposalFingerprint(proposal);
        let claim;
        try {
          claim = await options.authority.claimExecution({ callerOwnerId: input.caller.ownerId, approvalReference: input.approvalReference, proposal, fingerprint, spendAuthorization: input.spendAuthorization, now: now() });
        } catch {
          return safeResult('', 'blocked', 'Gateway authorization could not be verified');
        }
        if (!claim || (claim.status !== 'claimed' && claim.status !== 'already_claimed' && claim.status !== 'denied')) return safeResult('', 'blocked', 'Gateway returned an invalid authorization response');
        if (claim.status !== 'claimed') return safeResult('', 'blocked', claim.status === 'already_claimed' ? 'Execution authorization was already claimed' : 'Execution authorization was denied');
        const id = claim.executionId;
        if (!validId(id) || !claim.binding || typeof claim.binding !== 'object') return safeResult('', 'unknown', 'Gateway returned an invalid claimed execution; reconcile gateway state');
        if (!Number.isFinite(now()) || !Number.isFinite(claim.binding.expiresAt) || typeof claim.binding.spendCeilingWei !== 'string' || claim.binding.spendCeilingWei.length > 80 || !/^[1-9][0-9]*$/.test(claim.binding.spendCeilingWei) || claim.binding.spendAuthorizationId !== input.spendAuthorization.authorizationId || BigInt(claim.binding.spendCeilingWei) !== BigInt(input.spendAuthorization.maxAmountWei)) return persistOutcome(options.authority, id, 'blocked', { reason: 'Gateway spend authorization binding is invalid' });

        const sender = parseAddress(await options.signer.getAddress().catch(() => ''));
        if (!sender) return persistOutcome(options.authority, id, 'blocked', { reason: 'Signer address could not be verified' });
        if (!bindingMatches(claim.binding, proposal, fingerprint, sender, recipient, now())) return persistOutcome(options.authority, id, 'blocked', { reason: 'Authority binding does not exactly match the proposal' });
        let chainId: number;
        try { chainId = await options.rpc.getChainId(); } catch { return persistOutcome(options.authority, id, 'blocked', { reason: 'GOAT Testnet3 chain identity could not be verified' }); }
        if (chainId !== GOAT_TESTNET_CHAIN_ID) return persistOutcome(options.authority, id, 'blocked', { reason: 'GOAT Testnet3 chain gate failed' });
        let latestHash: Hash | undefined;
        let dispatchDenied = false;
        const assertDispatch = async (signal?: AbortSignal) => {
          if (signal?.aborted) throw new Error('Execution was interrupted before dispatch');
          const currentSender = parseAddress(await options.signer.getAddress().catch(() => ''));
          let currentChainId: number;
          try { currentChainId = await options.rpc.getChainId(); } catch { currentChainId = -1; }
          if (signal?.aborted) throw new Error('Execution was interrupted before dispatch');
          const currentTime = now();
          if (!currentSender || currentChainId !== GOAT_TESTNET_CHAIN_ID || !Number.isFinite(currentTime) || !bindingMatches(claim.binding, proposal, fingerprint, currentSender, recipient, currentTime)) {
            dispatchDenied = true;
            throw new Error('Execution binding expired or changed before dispatch');
          }
        };
        const signer = checkpointingSigner(options.signer, options.authority, id, (hash) => { latestHash = hash; }, assertDispatch);
        const action = transferNativeAction(signer);
        const runtime = new ExecutionRuntime(new PolicyEngine({ allowedNetworks: ['goat-testnet'], maxRiskWithoutConfirm: 'read', writeEnabled: true }), {
          maxRetries: 0,
          noRetryHighRiskWrites: true,
          defaultTimeoutMs: timeoutMs,
          logger: { log() {} },
        });
        const dispatchTime = now();
        if (!Number.isFinite(dispatchTime) || !bindingMatches(claim.binding, proposal, fingerprint, sender, recipient, dispatchTime)) return persistOutcome(options.authority, id, 'blocked', { reason: 'Authority binding expired or changed before broadcast' });
        let submitted;
        try {
          submitted = await runtime.run(action, { traceId: id, network: 'goat-testnet', caller: 'qpe-goat-adapter', now: dispatchTime }, { to: recipient, amountWei: amountWei.toString() }, { confirmed: true, idempotencyKey: id, timeoutMs });
        } catch {
          return persistOutcome(options.authority, id, 'unknown', { ...(latestHash ? { providerReference: latestHash } : {}), reason: 'Submission result is uncertain; reconcile before any retry' });
        }
        if (!submitted.ok || !submitted.output?.txHash) return persistOutcome(options.authority, id, dispatchDenied && !latestHash ? 'blocked' : 'unknown', { ...(latestHash ? { providerReference: latestHash } : {}), reason: dispatchDenied && !latestHash ? 'Authority binding expired or changed before dispatch' : 'Submission result is uncertain; reconcile before any retry' });
        const txHash = parseHash(submitted.output.txHash);
        if (!txHash || (latestHash && txHash.toLowerCase() !== latestHash.toLowerCase())) return persistOutcome(options.authority, id, 'unknown', { ...(latestHash ? { providerReference: latestHash } : {}), reason: 'AgentKit transaction identity is inconsistent; reconcile before any retry' });

        let verification;
        try { verification = await verifyReceipt(options.rpc, txHash, claim.binding, confirmations); }
        catch { return persistOutcome(options.authority, id, 'unknown', { providerReference: txHash, reason: 'Receipt verification failed; reconcile before any retry' }); }
        const evidence = verification.status === 'succeeded' || verification.status === 'failed'
          ? { transactionHash: txHash, receiptStatus: verification.status === 'succeeded' ? 'success' : 'reverted', blockNumber: verification.blockNumber.toString(), confirmations: verification.confirmations, settlementOnly: true }
          : undefined;
        if (verification.status === 'succeeded') {
          if (!evidence) return persistOutcome(options.authority, id, 'unknown', { providerReference: txHash, reason: 'Verified receipt evidence is incomplete' });
          try {
            await options.authority.recordOutcome({ executionId: id, status: 'succeeded', providerReference: txHash, evidence });
          } catch {
            return safeResult(id, 'unknown', 'Outcome persistence failed; reconcile before any retry', txHash);
          }
          return result({ executionId: id, status: 'succeeded', platform: 'goat', providerReference: txHash, actual: { itemId: proposal.itemId, money: proposal.money, receiptId: txHash }, evidence });
        }
        return persistOutcome(options.authority, id, verification.status, {
          providerReference: txHash,
          reason: verification.reason ?? (verification.status === 'failed' ? 'Transaction receipt reports revert' : 'Transaction outcome is not yet confirmed'),
          ...(evidence ? { evidence } : {}),
        });
      } catch {
        return safeResult('', 'blocked', 'GOAT proposal or execution input is invalid');
      }
    },

    async reconcile(input: { caller: { ownerId: string }; executionId: string }): Promise<PaymentResult> {
      if (!validId(input.caller?.ownerId) || !validId(input.executionId)) return safeResult('', 'blocked', 'Trusted execution identity is required for reconciliation');
      let record;
      try { record = await options.authority.getExecutionForReconciliation({ callerOwnerId: input.caller.ownerId, executionId: input.executionId }); } catch { return safeResult(input.executionId, 'unknown', 'Trusted execution lookup failed'); }
      if (!record || record.executionId !== input.executionId || record.ownerId !== input.caller.ownerId || !validId(record.ownerId)) return safeResult(input.executionId, 'blocked', 'No matching trusted execution was found');
      const txHash = parseHash(record.txHash);
      if (!txHash || (record.phase !== 'signed' && record.phase !== 'broadcast')) return safeResult(record.executionId, 'unknown', 'No durable signed transaction checkpoint exists yet');
      let proposal: PurchaseProposal;
      try {
        proposal = PurchaseProposalSchema.parse(record.proposal);
        if (proposal.ownerId !== record.ownerId || proposal.platform !== 'goat' || proposal.asset !== GOAT_NATIVE_ASSET || proposal.chain !== 'goat-testnet' || !reconciliationBindingMatches(record.binding, proposal, proposalFingerprint(proposal)) || GoatProviderArgsSchema.parse(proposal.providerArgs).recipient.toLowerCase() !== record.binding.destination.toLowerCase()) return safeResult(record.executionId, 'unknown', 'Trusted execution binding is inconsistent');
      } catch { return safeResult(record.executionId, 'unknown', 'Trusted execution binding is malformed'); }
      try {
        if (await options.rpc.getChainId() !== GOAT_TESTNET_CHAIN_ID) return safeResult(record.executionId, 'unknown', 'GOAT Testnet3 chain identity could not be verified', txHash);
      } catch { return safeResult(record.executionId, 'unknown', 'GOAT Testnet3 chain identity could not be verified', txHash); }
      let verified;
      try { verified = await verifyReceipt(options.rpc, txHash, record.binding, confirmations); }
      catch { return persistOutcome(options.authority, record.executionId, 'unknown', { providerReference: txHash, reason: 'Receipt verification failed; reconcile before any retry' }); }
      const evidence = verified.status === 'succeeded' || verified.status === 'failed'
        ? { transactionHash: txHash, receiptStatus: verified.status === 'succeeded' ? 'success' : 'reverted', blockNumber: verified.blockNumber.toString(), confirmations: verified.confirmations, settlementOnly: true }
        : undefined;
      if (verified.status === 'succeeded') {
        try {
          await options.authority.recordOutcome({ executionId: record.executionId, status: 'succeeded', providerReference: txHash, ...(evidence ? { evidence } : {}) });
        } catch {
          return safeResult(record.executionId, 'unknown', 'Outcome persistence failed; reconcile before any retry', txHash);
        }
        return result({ executionId: record.executionId, status: 'succeeded', platform: 'goat', providerReference: txHash, actual: { itemId: proposal.itemId, money: proposal.money, receiptId: txHash }, ...(evidence ? { evidence } : {}) });
      }
      return persistOutcome(options.authority, record.executionId, verified.status, {
        providerReference: txHash,
        ...(verified.status === 'failed' ? { reason: 'Transaction receipt reports revert' } : 'reason' in verified ? { reason: verified.reason } : {}),
        ...(evidence ? { evidence } : {}),
      });
    },
  };
}

export function createGoatTestnetRuntime(privateKey: `0x${string}`, rpcUrl = GOAT_TESTNET_RPC_URL) {
  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl, { retryCount: 0, timeout: 15_000 });
  const wallet = new ViemWalletProvider(account, GOAT_CHAIN, transport, 'goat-testnet');
  const client = createPublicClient({ chain: GOAT_CHAIN, transport });
  const rpc: GoatRpc = {
    getChainId: () => client.getChainId(),
    getBlockNumber: () => client.getBlockNumber(),
    async getTransaction({ hash }) {
      const transaction = await client.getTransaction({ hash });
      if (!transaction) return null;
      return {
        hash: transaction.hash,
        from: transaction.from,
        to: transaction.to,
        value: transaction.value,
        blockNumber: transaction.blockNumber,
        ...(transaction.chainId !== undefined && transaction.chainId !== null ? { chainId: transaction.chainId } : {}),
      };
    },
    async getTransactionReceipt({ hash }) {
      const receipt = await client.getTransactionReceipt({ hash });
      return { transactionHash: receipt.transactionHash, status: receipt.status, blockNumber: receipt.blockNumber };
    },
  };
  return { signer: wallet, rpc, address: account.address };
}
