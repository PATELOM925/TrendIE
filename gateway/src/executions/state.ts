import type { PaymentResult } from '../schemas/contracts.js';
import { canonicalJson } from '../schemas/canonical.js';

export type StoredExecution = Pick<PaymentResult, 'status' | 'platform' | 'txHashOrCheckoutRef' | 'error' | 'evidence'>;
const terminal = new Set(['blocked', 'succeeded', 'failed']);

export function normalizeStatus(status: string): string {
  return status === 'pending_unknown' ? 'unknown' : status;
}

export function sameOutcome(a: StoredExecution, b: PaymentResult): boolean {
  return normalizeStatus(a.status) === normalizeStatus(b.status) && a.platform === b.platform && a.txHashOrCheckoutRef === b.txHashOrCheckoutRef && a.error === b.error && canonicalJson(a.evidence) === canonicalJson(b.evidence);
}

export function validOutcome(next: PaymentResult): boolean {
  const status = normalizeStatus(next.status);
  if (status === 'succeeded') return Boolean(next.txHashOrCheckoutRef) && Object.keys(next.evidence).length > 0;
  if (status === 'failed') return Object.keys(next.evidence).length > 0;
  return ['pending_approval', 'submitting', 'pending', 'unknown', 'blocked'].includes(status);
}

export function canTransition(current: string, next: PaymentResult): boolean {
  const from = normalizeStatus(current);
  const to = normalizeStatus(next.status);
  if (terminal.has(from)) return false;
  if (from === 'unknown' && to === 'blocked') return false;
  const transitions: Record<string, string[]> = {
    pending_approval: ['pending_approval', 'submitting', 'pending', 'unknown', 'succeeded', 'failed'],
    submitting: ['submitting', 'pending', 'unknown', 'succeeded', 'failed'],
    pending: ['pending', 'unknown', 'succeeded', 'failed'],
    unknown: ['unknown', 'pending', 'succeeded', 'failed'],
  };
  return Boolean(transitions[from]?.includes(to)) && validOutcome(next);
}
