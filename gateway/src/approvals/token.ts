import { createHmac, randomUUID } from 'node:crypto';
import { config } from '../config.js';

export interface ApprovalPayload {
  approvalId: string;
  executionId: string;
  proposalHash: string;
  intentId: string;
  expiresAt: string;
}

export function generateHmacSignature(payload: ApprovalPayload): string {
  const content = `${payload.approvalId}|${payload.executionId}|${payload.proposalHash}|${payload.intentId}|${payload.expiresAt}|${config.APPROVAL_KEY_ID}`;
  return createHmac('sha256', config.APPROVAL_HMAC_SECRET).update(content).digest('hex');
}

export function createApprovalId(): string {
  return `apr_${randomUUID().replace(/-/g, '')}`;
}

export function createExecutionId(): string {
  return `exe_${randomUUID().replace(/-/g, '')}`;
}
