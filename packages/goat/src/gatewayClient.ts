import {
  GOAT_NATIVE_ASSET,
  GOAT_NATIVE_SCALE,
  GOAT_TESTNET_CHAIN_ID,
  type GoatBinding,
  type GoatClaim,
  type GoatGatewayAuthority,
  type GoatReconciliationRecord,
} from './types.js';
import { parseAddress } from './verification.js';

export interface HttpGoatGatewayClientOptions {
  baseUrl: string;
  apiKey: string;
  mode?: 'fail-closed' | 'active';
  senderAddress?: string;
  fetchFn?: typeof fetch;
}

const unsupported = 'GOAT HTTP gateway contract is unsupported until trusted durable endpoints are available';

export function createHttpGoatGatewayAuthority(
  options: HttpGoatGatewayClientOptions
): GoatGatewayAuthority {
  if (options.mode !== 'active') {
    return {
      async claimExecution() {
        return { status: 'denied', reason: unsupported };
      },
      async recordSubmissionCheckpoint() {
        throw new Error(unsupported);
      },
      async recordOutcome() {
        throw new Error(unsupported);
      },
      async getExecutionForReconciliation() {
        return undefined;
      },
    };
  }

  const base = options.baseUrl.replace(/\/$/, '');
  const doFetch = options.fetchFn ?? fetch;

  return {
    async claimExecution(input): Promise<GoatClaim> {
      const url = `${base}/approvals/${encodeURIComponent(input.approvalReference)}/consume`;
      const recipientStr = typeof input.proposal.providerArgs?.recipient === 'string'
        ? input.proposal.providerArgs.recipient
        : '';
      const listingRef = typeof input.proposal.providerArgs?.listingRef === 'string'
        ? input.proposal.providerArgs.listingRef
        : input.proposal.itemId;

      const body = JSON.stringify({
        intentId: input.proposal.intentId,
        seller: input.proposal.sellerId,
        product: input.proposal.itemId,
        amount: input.proposal.money.amount,
        currency: input.proposal.asset,
        destination: recipientStr,
        sourceRef: listingRef,
      });

      try {
        const res = await doFetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': options.apiKey,
          },
          body,
        });

        if (res.ok) {
          const data = (await res.json()) as { executionId: string };
          const recipient = parseAddress(recipientStr);
          if (!recipient) {
            return { status: 'denied', reason: 'Invalid proposal recipient address' };
          }
          const sender = parseAddress(options.senderAddress ?? '0x0000000000000000000000000000000000000001');
          if (!sender) {
            return { status: 'denied', reason: 'Invalid adapter sender address' };
          }

          const binding: GoatBinding = {
            platform: 'goat',
            fingerprint: input.fingerprint,
            ownerId: input.proposal.ownerId,
            intentId: input.proposal.intentId,
            intentVersion: input.proposal.intentVersion,
            sender,
            destination: recipient,
            asset: GOAT_NATIVE_ASSET,
            chainId: GOAT_TESTNET_CHAIN_ID,
            amount: input.proposal.money.amount,
            scale: GOAT_NATIVE_SCALE,
            expiresAt: input.now + 60_000,
            spendAuthorizationId: input.spendAuthorization.authorizationId,
            spendCeilingWei: input.spendAuthorization.maxAmountWei,
          };

          return { status: 'claimed', executionId: data.executionId, binding };
        }

        const text = await res.text().catch(() => '');
        if (res.status === 403 && (text.includes('CONSUME_FAILED') || text.includes('ALREADY') || text.includes('already'))) {
          return { status: 'already_claimed', reason: 'Execution authorization was already claimed' };
        }

        return { status: 'denied', reason: text || `Gateway consume rejected: HTTP ${res.status}` };
      } catch (err) {
        return { status: 'denied', reason: err instanceof Error ? err.message : 'Gateway network error' };
      }
    },

    async recordSubmissionCheckpoint(input): Promise<void> {
      const url = `${base}/executions/${encodeURIComponent(input.executionId)}/result`;
      const status = input.phase === 'signed' ? 'submitting' : 'pending';
      const body = JSON.stringify({
        executionId: input.executionId,
        status,
        platform: 'goat',
        txHashOrCheckoutRef: input.txHash,
        error: null,
        evidence: { phase: input.phase, txHash: input.txHash },
      });

      const res = await doFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': options.apiKey,
        },
        body,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to record submission checkpoint: ${text || res.status}`);
      }
    },

    async recordOutcome(input): Promise<void> {
      const url = `${base}/executions/${encodeURIComponent(input.executionId)}/result`;
      const body = JSON.stringify({
        executionId: input.executionId,
        status: input.status,
        platform: 'goat',
        txHashOrCheckoutRef: input.providerReference ?? null,
        error: input.reason ?? null,
        evidence: (input.evidence as Record<string, unknown>) ?? { recordedAt: new Date().toISOString() },
      });

      const res = await doFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': options.apiKey,
        },
        body,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to record outcome: ${text || res.status}`);
      }
    },

    async getExecutionForReconciliation(): Promise<GoatReconciliationRecord | undefined> {
      return undefined;
    },
  };
}
