export function capApprovalExpiry(now: Date, ttlSeconds: number, intentExpiry: string): string {
  const ttlExpiry = now.getTime() + ttlSeconds * 1000;
  const cap = new Date(intentExpiry).getTime();
  return new Date(Math.min(ttlExpiry, cap)).toISOString();
}

export function isIntentActive(expiry: string, now: Date): boolean {
  const expiryMs = new Date(expiry).getTime();
  return Number.isFinite(now.getTime()) && Number.isFinite(expiryMs) && expiryMs > now.getTime();
}
