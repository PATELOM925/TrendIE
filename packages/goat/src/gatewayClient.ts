import type {
  GoatGatewayAuthority,
  GoatClaim,
  GoatBinding,
  GoatSpendAuthorization,
  GoatReconciliationRecord,
} from './types.js';
import type { PurchaseProposal, JsonValue } from '@trendie/contracts';
import { GOAT_NATIVE_ASSET, GOAT_NATIVE_SCALE, GOAT_TESTNET_CHAIN_ID } from './types.js';
import type { Address, Hash } from 'viem';

export interface HttpGoatGatewayClientOptions {
  baseUrl: string;
  apiKey: string;
}

/**
 * Production GoatGatewayAuthority HTTP client connecting the GOAT adapter
 * to Person 1's Security Gateway with role 'adapter-goat'.
 */
export function createHttpGoatGatewayAuthority(
  options: HttpGoatGatewayClientOptions
): GoatGatewayAuthority {
  const { baseUrl, apiKey } = options;

  // In-memory reconciliation cache for checkpoints during transaction lifecycle
  const reconciliationCache = new Map<string, GoatReconciliationRecord>();

  return {
    async claimExecution(input: {
      callerOwnerId: string;
      approvalReference: string;
      proposal: PurchaseProposal;
      fingerprint: string;
      spendAuthorization: GoatSpendAuthorization;
      now: number;
    }): Promise<GoatClaim> {
      try {
        const destination =
          (input.proposal.providerArgs?.recipient as string) ||
          (input.proposal.providerArgs?.destination as string) ||
          input.proposal.sellerId;

        const gatewayProposal = {
          intentId: input.proposal.intentId,
          seller: input.proposal.sellerId,
          product: input.proposal.itemId,
          amount: input.proposal.money.amount,
          currency: input.proposal.asset,
          destination,
          sourceRef: (input.proposal.providerArgs?.sourceRef as string) || `goat:${input.proposal.itemId}`,
        };

        const res = await fetch(
          `${baseUrl}/approvals/${encodeURIComponent(input.approvalReference)}/consume`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
            body: JSON.stringify(gatewayProposal),
          }
        );

        if (res.status === 200) {
          const data = (await res.json()) as { executionId: string };
          const sender = (input.proposal.providerArgs?.sender as Address) || '0x0000000000000000000000000000000000000001';

          const binding: GoatBinding = {
            platform: 'goat',
            fingerprint: input.fingerprint,
            ownerId: input.callerOwnerId,
            intentId: input.proposal.intentId,
            intentVersion: input.proposal.intentVersion,
            sender,
            destination: destination as Address,
            asset: GOAT_NATIVE_ASSET,
            chainId: GOAT_TESTNET_CHAIN_ID,
            amount: input.proposal.money.amount,
            scale: GOAT_NATIVE_SCALE,
            expiresAt: input.now + 300_000,
            spendAuthorizationId: input.spendAuthorization.authorizationId,
            spendCeilingWei: input.spendAuthorization.maxAmountWei,
          };

          return {
            status: 'claimed',
            executionId: data.executionId,
            binding,
          };
        }

        if (res.status === 403) {
          const errData = (await res.json().catch(() => ({}))) as { message?: string };
          return {
            status: 'denied',
            reason: errData.message || 'Forbidden: Approval cannot be consumed or already claimed',
          };
        }

        return {
          status: 'denied',
          reason: `Gateway returned status ${res.status}`,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          status: 'denied',
          reason: `Connection error to Gateway: ${msg}`,
        };
      }
    },

    async recordSubmissionCheckpoint(input: {
      executionId: string;
      phase: 'signed' | 'broadcast';
      txHash: Hash;
    }): Promise<void> {
      // Store in checkpoint cache for reconciliation
      const existing = reconciliationCache.get(input.executionId);
      if (existing) {
        existing.phase = input.phase;
        existing.txHash = input.txHash;
      }
    },

    async recordOutcome(input: {
      executionId: string;
      status: 'blocked' | 'pending' | 'succeeded' | 'failed' | 'unknown';
      providerReference?: string;
      reason?: string;
      evidence?: JsonValue;
    }): Promise<void> {
      let mappedStatus: 'succeeded' | 'failed' | 'pending_unknown' = 'pending_unknown';
      if (input.status === 'succeeded') {
        mappedStatus = 'succeeded';
      } else if (input.status === 'failed' || input.status === 'blocked') {
        mappedStatus = 'failed';
      }

      const gatewayPayment = {
        executionId: input.executionId,
        status: mappedStatus,
        platform: 'goat',
        txHashOrCheckoutRef: input.providerReference || null,
        error: input.reason || null,
      };

      await fetch(`${baseUrl}/executions/${encodeURIComponent(input.executionId)}/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(gatewayPayment),
      });
    },

    async getExecutionForReconciliation(input: {
      callerOwnerId: string;
      executionId: string;
    }): Promise<GoatReconciliationRecord | undefined> {
      const record = reconciliationCache.get(input.executionId);
      if (record && record.ownerId === input.callerOwnerId) {
        return record;
      }
      return undefined;
    },
  };
}
