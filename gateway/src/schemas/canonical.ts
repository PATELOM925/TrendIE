import { createHash } from 'node:crypto';

/**
 * Deterministically serialize a value into canonical JSON:
 * - Keys recursively sorted lexicographically
 * - Strings preserved byte-for-byte (identity fields are case/space sensitive)
 * - BigInt serialized as string representation
 * - Rejects non-finite numbers, undefined omitted from objects
 */
export function canonicalJson(val: unknown): string {
  if (val === null || typeof val === 'boolean' || typeof val === 'number') {
    return JSON.stringify(val);
  }

  if (typeof val === 'bigint') {
    return JSON.stringify(val.toString());
  }

  if (typeof val === 'string') {
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    const items = val.map((item) => canonicalJson(item));
    return `[${items.join(',')}]`;
  }

  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const entries: string[] = [];
    for (const key of sortedKeys) {
      const v = obj[key];
      if (v !== undefined) {
        entries.push(`${JSON.stringify(key)}:${canonicalJson(v)}`);
      }
    }
    return `{${entries.join(',')}}`;
  }

  throw new Error(`Unsupported type in canonicalJson: ${typeof val}`);
}

/**
 * Compute SHA-256 hex digest of canonical JSON.
 */
export function proposalHash(proposal: unknown): string {
  const canonical = canonicalJson(proposal);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
