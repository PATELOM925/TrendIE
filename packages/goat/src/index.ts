import { ExecutionRuntime, PolicyEngine, ViemWalletProvider } from '@goatnetwork/agentkit/core';
import { transferNativeAction } from '@goatnetwork/agentkit/plugins';
import { PaymentResultSchema, PurchaseProposalSchema, proposalFingerprint, type JsonValue, type PaymentResult, type PurchaseProposal } from '@trendie/contracts';
import { createPublicClient, http, type Address, type Chain, type Hash, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const GOAT_TESTNET_CHAIN_ID = 48816;
export const GOAT_TESTNET_RPC_URL = 'https://rpc.testnet3.goat.network';
export const GOAT_NATIVE_ASSET = 'BTC';
export const GOAT_NATIVE_SCALE = 18;

const goatChain: Chain = {
  id: GOAT_TESTNET_CHAIN_ID,
  name: 'goat-testnet',
  nativeCurrency: { name: 'BTC', symbol: 'BTC', decimals: GOAT_NATIVE_SCALE },
  rpcUrls: { default: { http: [GOAT_TESTNET_RPC_URL] } },
};

export interface GoatBinding {
  platform: 'goat';
  fingerprint: string;
  ownerId: string;
  intentId: string;
  intentVersion: number;
  destination: Address;
  asset: typeof GOAT_NATIVE_ASSET;
  chainId: typeof GOAT_TESTNET_CHAIN_ID;
  amount: string;
  scale: typeof GOAT_NATIVE_SCALE;
  expiresAt: number;
}

export type GoatClaim =
  | { status: 'claimed'; executionId: string; binding: GoatBinding }
  | { status: 'already_claimed' | 'denied'; reason: string };

export interface GoatGatewayAuthority {
  claimExecution(input: { callerOwnerId: string; approvalReference: string; proposal: PurchaseProposal; fingerprint: string; now: number }): Promise<GoatClaim>;
  recordOutcome(input: { executionId: string; status: 'blocked' | 'pending' | 'succeeded' | 'failed' | 'unknown'; providerReference?: string; reason?: string; evidence?: JsonValue }): Promise<void>;
}

export interface GoatRpc {
  getChainId(): Promise<number>;
  getBlockNumber(): Promise<bigint>;
  getTransaction(input: { hash: Hash }): Promise<{ hash: Hash; from: Address; to: Address | null; value: bigint; blockNumber: bigint | null; chainId?: number } | null>;
  getTransactionReceipt(input: { hash: Hash }): Promise<{ transactionHash: Hash; status: 'success' | 'reverted'; blockNumber: bigint } | null>;
}

export interface GoatSigner {
  transferNative(to: string, amountWei: string): Promise<{ txHash: string }>;
}

export interface GoatAdapterOptions {
  authority: GoatGatewayAuthority;
  rpc: GoatRpc;
  signer: GoatSigner;
  numericSpendCeilingWei: string;
  confirmations?: number;
  now?: () => number;
}

export interface GoatExecutionInput {
  caller: { ownerId: string };
  approvalReference: string;
  proposal: PurchaseProposal;
}

function parseWei(amount: string, scale: number): bigint {
  if (scale !== GOAT_NATIVE_SCALE || !/^(0|[1-9][0-9]*)$/.test(amount)) throw new TypeError('GOAT native amounts require integer wei at scale 18');
  return BigInt(amount);
}

function result(value: PaymentResult): PaymentResult {
  return PaymentResultSchema.parse(value);
}

function bindingMatches(binding: GoatBinding, proposal: PurchaseProposal, fingerprint: string, destination: Address, now: number): boolean {
  return binding.platform === 'goat'
    && binding.fingerprint === fingerprint
    && binding.ownerId === proposal.ownerId
    && binding.intentId === proposal.intentId
    && binding.intentVersion === proposal.intentVersion
    && binding.destination.toLowerCase() === destination.toLowerCase()
    && binding.asset === GOAT_NATIVE_ASSET
    && binding.chainId === GOAT_TESTNET_CHAIN_ID
    && binding.amount === proposal.money.amount
    && binding.scale === proposal.money.scale
    && binding.expiresAt > now;
}

export function createGoatExecutionAdapter(options: GoatAdapterOptions) {
  const now = options.now ?? Date.now;
  const ceiling = BigInt(options.numericSpendCeilingWei);
  if (!/^(0|[1-9][0-9]*)$/.test(options.numericSpendCeilingWei) || ceiling <= 0n) throw new TypeError('A positive numeric GOAT spend ceiling in wei is required');
  const confirmations = options.confirmations ?? 1;
  if (!Number.isInteger(confirmations) || confirmations < 1) throw new TypeError('Confirmations must be a positive integer');

  return {
    async execute(input: GoatExecutionInput): Promise<PaymentResult> {
      const proposal = PurchaseProposalSchema.parse(input.proposal);
      const executionId = '';
      if (!input.caller.ownerId || input.caller.ownerId !== proposal.ownerId) return result({ executionId, status: 'blocked', platform: 'goat', reason: 'Caller owner does not match proposal owner' });
      if (proposal.platform !== 'goat') return result({ executionId, status: 'blocked', platform: 'goat', reason: 'Platform mismatch' });
      const recipient = proposal.providerArgs.recipient;
      if (typeof recipient !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) return result({ executionId, status: 'blocked', platform: 'goat', reason: 'GOAT proposal recipient is missing or invalid' });
      if (proposal.asset !== GOAT_NATIVE_ASSET || proposal.chain !== 'goat-testnet' || proposal.money.scale !== GOAT_NATIVE_SCALE) return result({ executionId, status: 'blocked', platform: 'goat', reason: 'Only native BTC on GOAT Testnet3 at scale 18 is supported' });
      const amountWei = parseWei(proposal.money.amount, proposal.money.scale);
      if (amountWei <= 0n || amountWei > ceiling) return result({ executionId, status: 'blocked', platform: 'goat', reason: 'Amount is outside the configured numeric testnet ceiling' });

      const fingerprint = proposalFingerprint(proposal);
      const claim = await options.authority.claimExecution({ callerOwnerId: input.caller.ownerId, approvalReference: input.approvalReference, proposal, fingerprint, now: now() });
      if (claim.status !== 'claimed') return result({ executionId, status: 'blocked', platform: 'goat', reason: claim.reason });
      const id = claim.executionId;
      const saveOutcome = async (status: 'blocked' | 'pending' | 'succeeded' | 'failed' | 'unknown', fields: { providerReference?: string; reason?: string; evidence?: JsonValue } = {}) => {
        try {
          await options.authority.recordOutcome({ executionId: id, status, ...fields });
        } catch {
          return result({ executionId: id, status: 'unknown', platform: 'goat', ...(fields.providerReference ? { providerReference: fields.providerReference } : {}), reason: 'Outcome persistence failed; reconcile before any retry' });
        }
        return result({ executionId: id, status, platform: 'goat', ...(fields.providerReference ? { providerReference: fields.providerReference } : {}), ...(fields.reason ? { reason: fields.reason } : {}), ...(fields.evidence ? { evidence: fields.evidence } : {}) });
      };

      const destination = recipient as Address;
      if (!bindingMatches(claim.binding, proposal, fingerprint, destination, now())) return saveOutcome('blocked', { reason: 'Authority binding does not exactly match the proposal' });
      const chainId = await options.rpc.getChainId().catch(() => -1);
      if (chainId !== GOAT_TESTNET_CHAIN_ID) return saveOutcome('blocked', { reason: `GOAT Testnet3 chain gate failed (${chainId})` });

      let txHash: Hash;
      try {
        const policy = new PolicyEngine({ allowedNetworks: ['goat-testnet'], maxRiskWithoutConfirm: 'read', writeEnabled: true });
        const runtime = new ExecutionRuntime(policy, { maxRetries: 0, noRetryHighRiskWrites: true, defaultTimeoutMs: 0 });
        const action = transferNativeAction(options.signer as never);
        const submitted = await runtime.run(action, { traceId: id, network: 'goat-testnet', caller: 'qpe-goat-adapter', now: now() }, { to: destination, amountWei: amountWei.toString() }, { confirmed: true, idempotencyKey: id });
        if (!submitted.ok || !submitted.output?.txHash) return saveOutcome('unknown', { reason: submitted.error ?? 'Submission result is ambiguous' });
        txHash = submitted.output.txHash as Hash;
      } catch {
        return saveOutcome('unknown', { reason: 'Submission may have reached the network; reconcile before any retry' });
      }

      let transaction;
      let receipt;
      try {
        transaction = await options.rpc.getTransaction({ hash: txHash });
        receipt = await options.rpc.getTransactionReceipt({ hash: txHash });
      } catch {
        return saveOutcome('unknown', { providerReference: txHash, reason: 'Transaction submitted; receipt lookup failed' });
      }
      if (!transaction || !receipt) return saveOutcome('pending', { providerReference: txHash, reason: 'Transaction is not yet included' });
      if (transaction.to?.toLowerCase() !== destination.toLowerCase() || transaction.value !== amountWei || (transaction.chainId !== undefined && transaction.chainId !== GOAT_TESTNET_CHAIN_ID)) {
        return saveOutcome('unknown', { providerReference: txHash, reason: 'Mined transaction fields do not match the approved binding' });
      }
      if (receipt.status === 'reverted') return saveOutcome('failed', { providerReference: txHash, reason: 'Transaction receipt reports revert', evidence: { receiptStatus: 'reverted', blockNumber: receipt.blockNumber.toString() } });
      const head = await options.rpc.getBlockNumber().catch(() => receipt.blockNumber);
      const depth = head >= receipt.blockNumber ? Number(head - receipt.blockNumber + 1n) : 0;
      if (depth < confirmations) return saveOutcome('pending', { providerReference: txHash, reason: 'Receipt is awaiting configured confirmations' });
      try {
        await options.authority.recordOutcome({ executionId: id, status: 'succeeded', providerReference: txHash, evidence: { transactionHash: txHash, receiptStatus: 'success', blockNumber: receipt.blockNumber.toString(), confirmations: depth, settlementOnly: true } });
      } catch {
        return result({ executionId: id, status: 'unknown', platform: 'goat', providerReference: txHash, reason: 'Outcome persistence failed; reconcile before any retry' });
      }
      return result({ executionId: id, status: 'succeeded', platform: 'goat', providerReference: txHash, actual: { itemId: proposal.itemId, money: proposal.money, receiptId: txHash }, evidence: { transactionHash: txHash, receiptStatus: 'success', blockNumber: receipt.blockNumber.toString(), confirmations: depth, settlementOnly: true } });
    },

    async reconcile(txHash: Hash, expected: { destination: Address; amountWei: string }): Promise<'unknown' | 'pending' | 'failed' | 'succeeded'> {
      if (await options.rpc.getChainId() !== GOAT_TESTNET_CHAIN_ID) return 'unknown';
      const transaction = await options.rpc.getTransaction({ hash: txHash });
      if (!transaction) return 'unknown';
      if (transaction.to?.toLowerCase() !== expected.destination.toLowerCase() || transaction.value !== BigInt(expected.amountWei)) return 'unknown';
      const receipt = await options.rpc.getTransactionReceipt({ hash: txHash });
      if (!receipt) return 'pending';
      if (receipt.status === 'reverted') return 'failed';
      const head = await options.rpc.getBlockNumber();
      return head >= receipt.blockNumber && Number(head - receipt.blockNumber + 1n) >= confirmations ? 'succeeded' : 'pending';
    },
  };
}

export function createGoatTestnetRuntime(privateKey: `0x${string}`, rpcUrl = GOAT_TESTNET_RPC_URL) {
  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl);
  const wallet = new ViemWalletProvider(account, goatChain, transport, 'goat-testnet');
  const client = createPublicClient({ chain: goatChain, transport });
  return {
    signer: wallet,
    rpc: client as PublicClient & GoatRpc,
    address: account.address,
  };
}
