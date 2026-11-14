import type { WalletProvider } from '@goatnetwork/agentkit/core';
import type { Address, Hash } from 'viem';
import type { JsonValue, PaymentResult, PurchaseProposal } from '@trendie/contracts';

export const GOAT_TESTNET_CHAIN_ID = 48816;
export const GOAT_TESTNET_RPC_URL = 'https://rpc.testnet3.goat.network';
export const GOAT_NATIVE_ASSET = 'BTC';
export const GOAT_NATIVE_SCALE = 18;

export interface GoatBinding {
  platform: 'goat';
  fingerprint: string;
  ownerId: string;
  intentId: string;
  intentVersion: number;
  sender: Address;
  destination: Address;
  asset: typeof GOAT_NATIVE_ASSET;
  chainId: typeof GOAT_TESTNET_CHAIN_ID;
  amount: string;
  scale: typeof GOAT_NATIVE_SCALE;
  expiresAt: number;
  spendAuthorizationId: string;
  spendCeilingWei: string;
}

export type GoatClaim =
  | { status: 'claimed'; executionId: string; binding: GoatBinding }
  | { status: 'already_claimed' | 'denied'; reason: string };

export interface GoatReconciliationRecord {
  executionId: string;
  ownerId: string;
  binding: GoatBinding;
  txHash: Hash;
  phase: 'signed' | 'broadcast';
  proposal: PurchaseProposal;
}

export interface GoatGatewayAuthority {
  claimExecution(input: { callerOwnerId: string; approvalReference: string; proposal: PurchaseProposal; fingerprint: string; spendAuthorization: GoatSpendAuthorization; now: number }): Promise<GoatClaim>;
  recordSubmissionCheckpoint(input: { executionId: string; phase: 'signed' | 'broadcast'; txHash: Hash }): Promise<void>;
  recordOutcome(input: { executionId: string; status: 'blocked' | 'pending' | 'succeeded' | 'failed' | 'unknown'; providerReference?: string; reason?: string; evidence?: JsonValue }): Promise<void>;
  getExecutionForReconciliation(input: { callerOwnerId: string; executionId: string }): Promise<GoatReconciliationRecord | undefined>;
}

export interface GoatRpcTransaction {
  hash: Hash;
  from: Address;
  to: Address | null;
  value: bigint;
  blockNumber: bigint | null;
  chainId?: number | null;
}

export interface GoatRpcReceipt {
  transactionHash: Hash;
  status: 'success' | 'reverted';
  blockNumber: bigint;
}

export interface GoatRpc {
  getChainId(): Promise<number>;
  getBlockNumber(): Promise<bigint>;
  getTransaction(input: { hash: Hash }): Promise<GoatRpcTransaction | null>;
  getTransactionReceipt(input: { hash: Hash }): Promise<GoatRpcReceipt | null>;
}

export type GoatSigner = WalletProvider;

export interface GoatAdapterOptions {
  authority: GoatGatewayAuthority;
  rpc: GoatRpc;
  signer: GoatSigner;
  numericSpendCeilingWei: string;
  confirmations?: number;
  executionTimeoutMs?: number;
  now?: () => number;
}

export interface GoatSpendAuthorization {
  ownerId: string;
  authorizationId: string;
  maxAmountWei: string;
}

export interface GoatExecutionInput {
  caller: { ownerId: string };
  approvalReference: string;
  proposal: PurchaseProposal;
  spendAuthorization: GoatSpendAuthorization;
}

export interface GoatReconcileInput {
  caller: { ownerId: string };
  executionId: string;
}

export type GoatPaymentResult = PaymentResult;
