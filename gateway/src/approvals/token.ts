import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { buildHmacKeyRing, config } from '../config.js';

/** Signing secrets by key id. Built once from the environment; never logged or returned by any route. */
const defaultKeyRing = buildHmacKeyRing(config);

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

/**
 * Signs with the secret registered for `keyId` (the current key unless stated). The key id
 * is part of the signed content, so a signature cannot be replayed under another key id.
 */
export function generateHmacSignature(
  payload: ApprovalPayload,
  keyId: string = config.APPROVAL_KEY_ID,
  keyRing: ReadonlyMap<string, string> = defaultKeyRing
): string {
  const secret = keyRing.get(keyId);
  if (!secret) throw new Error('Unknown approval signing key');
  const parts = [
    payload.approvalId,
    payload.executionId,
    payload.proposalHash,
    payload.intentId,
    payload.expiresAt,
    keyId,
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
  return createHmac('sha256', secret).update(content).digest('hex');
}

/**
 * Recomputes the HMAC for the given payload and compares it to the stored
 * signature using a constant-time comparison to prevent timing attacks.
 * `keyId` is the key id stored with the approval. An approval signed by a key that is
 * no longer loaded fails closed, which is how a leaked signing secret is retired.
 */
export function verifyHmacSignature(
  payload: ApprovalPayload,
  signature: string,
  keyId: string = config.APPROVAL_KEY_ID,
  keyRing: ReadonlyMap<string, string> = defaultKeyRing
): boolean {
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false;
  if (typeof keyId !== 'string' || !keyRing.has(keyId)) return false;
  const expected = generateHmacSignature(payload, keyId, keyRing);
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
    }, keyId, keyRing);
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
