import type { GoatGatewayAuthority } from './types.js';

export interface HttpGoatGatewayClientOptions {
  baseUrl: string;
  apiKey: string;
}

const unsupported = 'GOAT HTTP gateway contract is unsupported until trusted durable endpoints are available';

export function createHttpGoatGatewayAuthority(
  options: HttpGoatGatewayClientOptions
): GoatGatewayAuthority {
  void options;
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
