import {
  GatewayAuthority,
  ClaimResult,
  ApprovedBinding,
  TrustedCaller,
} from './execution.js';
import { PurchaseProposal, PaymentResult } from '@trendie/contracts';

export interface HttpGatewayClientOptions {
  baseUrl: string;
  apiKey: string;
}

/**
 * Production GatewayAuthority implementation that connects the Qatom adapter
 * to Person 1's Security Gateway over HTTP using role 'adapter-qatom'.
 */
export function createHttpGatewayAuthority(options: HttpGatewayClientOptions): GatewayAuthority {
  const { baseUrl, apiKey } = options;

  return {
    async claimExecution(input: {
      caller: TrustedCaller;
      approvalReference: string;
      proposal: PurchaseProposal;
      fingerprint: string;
    }): Promise<ClaimResult> {
      try {
        // Construct the proposal payload expected by gateway's POST /approvals/:id/consume
        const gatewayProposal = {
          intentId: input.proposal.intentId,
          seller: input.proposal.sellerId,
          product: input.proposal.itemId,
          amount: input.proposal.money.amount,
          currency: input.proposal.asset === 'USD-TDN' ? 'USDC' : input.proposal.asset,
          destination: (input.proposal.providerArgs?.destination as string) || input.proposal.sellerId,
          sourceRef: (input.proposal.providerArgs?.sourceRef as string) || `qatom:${input.proposal.itemId}`,
        };

        const res = await fetch(`${baseUrl}/approvals/${encodeURIComponent(input.approvalReference)}/consume`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify(gatewayProposal),
        });

        if (res.status === 200) {
          const data = (await res.json()) as { executionId: string };
          const binding: ApprovedBinding = {
            executionId: data.executionId,
            ownerId: input.caller.ownerId,
            intentId: input.proposal.intentId,
            intentVersion: input.proposal.intentVersion,
            proposalFingerprint: input.fingerprint,
            platform: 'qatom',
            itemId: input.proposal.itemId,
            sellerId: input.proposal.sellerId,
            money: input.proposal.money,
            asset: input.proposal.asset,
            chain: input.proposal.chain,
            providerArgs: input.proposal.providerArgs,
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          };
          return { kind: 'claimed', binding };
        }

        if (res.status === 403) {
          const errData = (await res.json().catch(() => ({}))) as { message?: string };
          return { kind: 'denied', reason: errData.message || 'Forbidden: Approval cannot be consumed' };
        }

        return { kind: 'denied', reason: `Gateway error: HTTP ${res.status}` };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { kind: 'denied', reason: `Connection error to Gateway: ${message}` };
      }
    },

    async recordOutcome(executionId: string, result: PaymentResult): Promise<void> {
      // Post PaymentResult to POST /executions/:id/result
      const gatewayPayment = {
        executionId,
        status: result.status === 'succeeded' ? 'succeeded' : result.status === 'failed' ? 'failed' : 'pending_unknown',
        platform: 'qatom',
        txHashOrCheckoutRef: result.providerReference || result.actual?.receiptId || null,
        error: result.reason || null,
      };

      await fetch(`${baseUrl}/executions/${encodeURIComponent(executionId)}/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(gatewayPayment),
      });
    },

    async claimContinuation(): Promise<{ kind: 'claimed'; binding: ApprovedBinding } | { kind: 'denied'; reason: string } | { kind: 'already_claimed' }> {
      return { kind: 'denied', reason: 'Qatom continuation not enabled: paid execution disabled' };
    },
  };
}
