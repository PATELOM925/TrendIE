import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
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

/**
 * Recomputes the HMAC for the given payload and compares it to the stored
 * signature using a constant-time comparison to prevent timing attacks.
 */
export function verifyHmacSignature(payload: ApprovalPayload, signature: string): boolean {
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = generateHmacSignature(payload);
  // Both hex strings are ASCII — same byte length. If lengths differ, fail fast.
  if (expected.length !== signature.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
}

export function createApprovalId(): string {
  return `apr_${randomUUID().replace(/-/g, '')}`;
}

export function createExecutionId(): string {
  return `exe_${randomUUID().replace(/-/g, '')}`;
}
