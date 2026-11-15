import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

export interface ApprovalPayload {
  approvalId: string;
  executionId: string;
  proposalHash: string;
  intentId: string;
  expiresAt: string;
  ownerId?: string;
  intentVersion?: string | number;
  platform?: string;
  chain?: string;
  asset?: string;
  scale?: number;
}

export function generateHmacSignature(payload: ApprovalPayload): string {
  const parts = [
    payload.approvalId,
    payload.executionId,
    payload.proposalHash,
    payload.intentId,
    payload.expiresAt,
    config.APPROVAL_KEY_ID,
  ];
  if (payload.ownerId !== undefined) {
    parts.push(
      String(payload.ownerId),
      String(payload.intentVersion ?? 1),
      String(payload.platform ?? ''),
      String(payload.chain ?? ''),
      String(payload.asset ?? ''),
      String(payload.scale ?? 0)
    );
  }
  const content = parts.join('|');
  return createHmac('sha256', config.APPROVAL_HMAC_SECRET).update(content).digest('hex');
}

/**
 * Recomputes the HMAC for the given payload and compares it to the stored
 * signature using a constant-time comparison to prevent timing attacks.
 */
export function verifyHmacSignature(payload: ApprovalPayload, signature: string): boolean {
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = generateHmacSignature(payload);
  if (expected.length === signature.length && timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'))) {
    return true;
  }
  if (payload.ownerId !== undefined) {
    const legacy = generateHmacSignature({
      approvalId: payload.approvalId,
      executionId: payload.executionId,
      proposalHash: payload.proposalHash,
      intentId: payload.intentId,
      expiresAt: payload.expiresAt,
    });
    if (legacy.length === signature.length && timingSafeEqual(Buffer.from(legacy, 'utf8'), Buffer.from(signature, 'utf8'))) {
      return true;
    }
  }
  return false;
}

export function createApprovalId(): string {
  return `apr_${randomUUID().replace(/-/g, '')}`;
}

export function createExecutionId(): string {
  return `exe_${randomUUID().replace(/-/g, '')}`;
}
