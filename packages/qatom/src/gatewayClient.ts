import type { GatewayAuthority, TrustedCaller } from './execution.js';

export interface HttpGatewayClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

const UNSUPPORTED = 'Gateway contract does not provide a verified persisted QPE binding';

export function createHttpGatewayAuthority(_options: HttpGatewayClientOptions): GatewayAuthority {
  return {
    async claimExecution() {
      return { kind: 'denied', reason: UNSUPPORTED };
    },
    async recordOutcome() {
      throw new Error('Gateway outcome persistence is unsupported until the full QPE contract is implemented');
    },
    async claimContinuation(): Promise<{ kind: 'denied'; reason: string }> {
      return { kind: 'denied', reason: UNSUPPORTED };
    },
  };
}
