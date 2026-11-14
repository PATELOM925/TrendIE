export { createQatomClient, QATOM_ENDPOINT } from './client.js';
export type { QatomMcpTransport, QatomReadClient, ToolDescription } from './client.js';
export { createQatomExecutionAdapter, disabledPaidExecution } from './execution.js';
export type {
  ApprovedBinding, BoundCheckoutCapability, ClaimResult, GatewayAuthority,
  PaidExecutionGate, QatomExecutionAdapter, QatomExecutionTransport, QatomReceiptVerifier,
  ReceiptAssessment, TrustedCaller,
} from './execution.js';

export const unsupportedBoundCheckout = {
  async supportsAtomicPriceBound() { return false; },
  async prepareBoundCall() { return undefined; },
};
