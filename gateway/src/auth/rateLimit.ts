export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /** Counts one event for the identity and reports whether it is within budget. */
  hit(id: string): RateLimitResult;
  /** True when the identity has already used its budget for the current window. Does not count. */
  isBlocked(id: string): boolean;
  retryAfterSeconds(id: string): number;
  size(): number;
}

interface Options {
  max: number;
  windowMs: number;
  now?: () => number;
  maxEntries?: number;
}

/**
 * Fixed-window, in-memory counter. State is per process: it resets on restart and is not
 * shared between gateway instances, so it bounds abuse of one instance rather than
 * providing a global quota.
 */
export function createRateLimiter({ max, windowMs, now = Date.now, maxEntries = 10_000 }: Options): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  const current = (id: string) => {
    const entry = windows.get(id);
    if (entry && entry.resetAt <= now()) {
      windows.delete(id);
      return undefined;
    }
    return entry;
  };

  const retryAfter = (id: string) => {
    const entry = current(id);
    return entry ? Math.max(1, Math.ceil((entry.resetAt - now()) / 1000)) : 0;
  };

  const evict = () => {
    const time = now();
    for (const [id, entry] of windows) if (entry.resetAt <= time) windows.delete(id);
    // Still full of live windows: drop the oldest so memory stays bounded under a flood of identities.
    while (windows.size >= maxEntries) {
      const oldest = windows.keys().next();
      if (oldest.done) break;
      windows.delete(oldest.value);
    }
  };

  return {
    hit(id) {
      let entry = current(id);
      if (!entry) {
        if (windows.size >= maxEntries) evict();
        entry = { count: 0, resetAt: now() + windowMs };
        windows.set(id, entry);
      }
      entry.count += 1;
      const allowed = entry.count <= max;
      return { allowed, retryAfterSeconds: allowed ? 0 : retryAfter(id) };
    },
    isBlocked(id) {
      const entry = current(id);
      return Boolean(entry && entry.count >= max);
    },
    retryAfterSeconds: retryAfter,
    size: () => windows.size,
  };
}
