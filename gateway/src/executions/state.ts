import type { PaymentResult } from '../schemas/contracts.js';

export type StoredExecution = Pick<PaymentResult, 'status' | 'platform' | 'txHashOrCheckoutRef' | 'error' | 'evidence'>;
const terminal = new Set(['blocked', 'succeeded', 'failed']);

export function normalizeStatus(status: string): string {
  return status === 'pending_unknown' ? 'unknown' : status;
}

export function sameOutcome(a: StoredExecution, b: PaymentResult): boolean {
  return normalizeStatus(a.status) === normalizeStatus(b.status) && a.platform === b.platform && a.txHashOrCheckoutRef === b.txHashOrCheckoutRef && a.error === b.error && JSON.stringify(a.evidence) === JSON.stringify(b.evidence);
}

export function canTransition(current: string, next: PaymentResult): boolean {
  const from = normalizeStatus(current);
  const to = normalizeStatus(next.status);
  if (terminal.has(from)) return false;
  if (from === 'unknown' && to === 'blocked') return false;
  if (!['pending_approval', 'submitting', 'pending', 'unknown'].includes(from) || !['succeeded', 'failed'].includes(to)) return false;
  if (to === 'succeeded' && (!next.txHashOrCheckoutRef || Object.keys(next.evidence).length === 0)) return false;
  if (to === 'failed' && Object.keys(next.evidence).length === 0) return false;
  return true;
}
