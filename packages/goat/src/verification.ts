import { PaymentResultSchema, type PaymentResult, type PurchaseProposal } from '@trendie/contracts';
import { getAddress, type Address, type Hash } from 'viem';
import { GOAT_NATIVE_ASSET, GOAT_NATIVE_SCALE, GOAT_TESTNET_CHAIN_ID, type GoatBinding, type GoatRpc } from './types.js';
import { GoatProviderArgsSchema } from './provider-args.js';

export { GoatProviderArgsSchema };

export function parseWei(amount: string, scale: number): bigint {
  if (scale !== GOAT_NATIVE_SCALE || !/^(0|[1-9][0-9]*)$/.test(amount)) throw new TypeError('GOAT native amounts require integer wei at scale 18');
  return BigInt(amount);
}

export function parseHash(value: unknown): Hash | undefined {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value) ? value as Hash : undefined;
}

export function parseAddress(value: unknown): Address | undefined {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) return undefined;
  try { return getAddress(value); } catch { return undefined; }
}

export function result(value: PaymentResult): PaymentResult {
  return PaymentResultSchema.parse(value);
}

export function bindingMatches(binding: GoatBinding, proposal: PurchaseProposal, fingerprint: string, sender: Address, destination: Address, now: number): boolean {
  if (!binding || typeof binding !== 'object') return false;
  const boundSender = parseAddress(binding.sender);
  const boundDestination = parseAddress(binding.destination);
  if (!boundSender || !boundDestination || typeof binding.amount !== 'string' || typeof binding.scale !== 'number' || typeof binding.intentVersion !== 'number') return false;
  return Number.isFinite(now)
    && Number.isFinite(binding.expiresAt)
    && binding.platform === 'goat'
    && binding.fingerprint === fingerprint
    && binding.ownerId === proposal.ownerId
    && binding.intentId === proposal.intentId
    && binding.intentVersion === proposal.intentVersion
    && boundSender.toLowerCase() === sender.toLowerCase()
    && boundDestination.toLowerCase() === destination.toLowerCase()
    && binding.asset === GOAT_NATIVE_ASSET
    && binding.chainId === GOAT_TESTNET_CHAIN_ID
    && binding.amount === proposal.money.amount
    && binding.scale === proposal.money.scale
    && validSpendBinding(binding)
    && typeof binding.spendCeilingWei === 'string'
    && /^[1-9][0-9]*$/.test(binding.spendCeilingWei)
    && binding.expiresAt > now;
}

export function reconciliationBindingMatches(binding: GoatBinding, proposal: PurchaseProposal, fingerprint: string): boolean {
  if (!binding || typeof binding !== 'object') return false;
  const sender = parseAddress(binding.sender);
  const destination = parseAddress(binding.destination);
  return !!sender && !!destination
    && binding.platform === 'goat'
    && binding.fingerprint === fingerprint
    && binding.ownerId === proposal.ownerId
    && binding.intentId === proposal.intentId
    && binding.intentVersion === proposal.intentVersion
    && binding.destination.toLowerCase() === String(proposal.providerArgs.recipient).toLowerCase()
    && binding.asset === GOAT_NATIVE_ASSET
    && binding.chainId === GOAT_TESTNET_CHAIN_ID
    && binding.amount === proposal.money.amount
    && binding.scale === proposal.money.scale
    && typeof binding.expiresAt === 'number'
    && Number.isFinite(binding.expiresAt)
    && validSpendBinding(binding);
}

function validSpendBinding(binding: GoatBinding): boolean {
  return typeof binding.spendAuthorizationId === 'string'
    && binding.spendAuthorizationId.length > 0
    && typeof binding.spendCeilingWei === 'string'
    && binding.spendCeilingWei.length <= 80
    && /^[1-9][0-9]*$/.test(binding.spendCeilingWei)
    && typeof binding.amount === 'string'
    && /^(0|[1-9][0-9]*)$/.test(binding.amount)
    && BigInt(binding.amount) <= BigInt(binding.spendCeilingWei);
}

export type Verification =
  | { status: 'pending' | 'unknown'; reason: string; providerReference: Hash; blockNumber?: never; confirmations?: never }
  | { status: 'failed' | 'succeeded'; providerReference: Hash; blockNumber: bigint; confirmations: number; reason?: string };

export async function verifyReceipt(rpc: GoatRpc, txHash: Hash, binding: GoatBinding, minConfirmations: number): Promise<Verification> {
  if (!parseHash(txHash)) return { status: 'unknown', providerReference: txHash, reason: 'Transaction hash is malformed' };
  const sender = parseAddress(binding?.sender);
  const destination = parseAddress(binding?.destination);
  if (!sender || !destination || typeof binding.amount !== 'string' || !/^(0|[1-9][0-9]*)$/.test(binding.amount)) return { status: 'unknown', providerReference: txHash, reason: 'Trusted transaction binding is malformed' };
  let transaction;
  let receipt;
  try {
    transaction = await rpc.getTransaction({ hash: txHash });
    receipt = await rpc.getTransactionReceipt({ hash: txHash });
  } catch {
    return { status: 'unknown', providerReference: txHash, reason: 'Transaction or receipt lookup failed' };
  }
  if (!transaction && !receipt) return { status: 'unknown', providerReference: txHash, reason: 'Transaction was not found' };
  if (!transaction) return { status: 'unknown', providerReference: txHash, reason: 'Receipt exists without its transaction' };
  if (typeof transaction.hash !== 'string' || !parseHash(transaction.hash) || transaction.hash.toLowerCase() !== txHash.toLowerCase()
    || typeof transaction.from !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(transaction.from)
    || (transaction.to !== null && (typeof transaction.to !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(transaction.to)))
    || typeof transaction.value !== 'bigint'
    || transaction.chainId !== GOAT_TESTNET_CHAIN_ID
    || transaction.from.toLowerCase() !== sender.toLowerCase()
    || transaction.to?.toLowerCase() !== destination.toLowerCase()
    || transaction.value !== BigInt(binding.amount)) {
    return { status: 'unknown', providerReference: txHash, reason: 'Transaction and receipt identity do not match the approved binding' };
  }
  if (!receipt) return { status: 'pending', providerReference: txHash, reason: 'Transaction is visible but receipt is not yet available' };
  if (typeof receipt.transactionHash !== 'string' || !parseHash(receipt.transactionHash) || receipt.transactionHash.toLowerCase() !== txHash.toLowerCase()
    || transaction.blockNumber === null || typeof transaction.blockNumber !== 'bigint'
    || typeof receipt.blockNumber !== 'bigint' || transaction.blockNumber !== receipt.blockNumber) return { status: 'unknown', providerReference: txHash, reason: 'Transaction and receipt identity do not match the approved binding' };
  if (receipt.status !== 'success' && receipt.status !== 'reverted') return { status: 'unknown', providerReference: txHash, reason: 'Receipt status is malformed' };
  let head: bigint;
  try {
    head = await rpc.getBlockNumber();
    if (typeof head !== 'bigint' || head < receipt.blockNumber) return { status: 'unknown', providerReference: txHash, reason: 'Current block height is invalid' };
  } catch {
    return { status: 'unknown', providerReference: txHash, reason: 'Current block height could not be verified' };
  }
  const depth = Number(head - receipt.blockNumber + 1n);
  if (!Number.isSafeInteger(depth) || depth < minConfirmations) return { status: 'pending', providerReference: txHash, reason: 'Receipt is awaiting configured confirmations' };
  return { status: receipt.status === 'success' ? 'succeeded' : 'failed', providerReference: txHash, blockNumber: receipt.blockNumber, confirmations: depth };
}
