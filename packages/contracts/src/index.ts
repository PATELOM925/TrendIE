import { createHash } from 'node:crypto';
import { z } from 'zod';

export const CONTRACT_VERSION = 1 as const;
export const canonicalizationVersion = 'trendie-json-v1' as const;

const integerString = z.string().regex(/^(0|[1-9][0-9]*)$/).max(80);
export const MoneySchema = z.object({ amount: integerString, scale: z.number().int().min(0).max(255) }).strict();
export type Money = z.infer<typeof MoneySchema>;

export const PaymentStatusSchema = z.enum([
  'pending_approval', 'submitting', 'pending', 'succeeded', 'failed', 'unknown', 'blocked',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.null(), z.boolean(), z.string().max(20_000), z.number().finite().refine((v) => !Number.isInteger(v) || Number.isSafeInteger(v)),
  z.array(JsonValueSchema).max(200),
  z.record(z.string().max(256), JsonValueSchema),
]));
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const PurchaseProposalObjectSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  ownerId: z.string().min(1).max(256),
  intentId: z.string().min(1).max(256),
  intentVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  platform: z.enum(['qatom', 'goat']),
  itemId: z.string().min(1).max(512),
  sellerId: z.string().min(1).max(512),
  money: MoneySchema,
  asset: z.string().min(1).max(64),
  chain: z.string().min(1).max(128),
  providerArgs: z.record(z.string().max(256), JsonValueSchema).refine((v) => Object.keys(v).length <= 100),
}).strict().superRefine((proposal, context) => {
  if (proposal.platform === 'qatom' && (proposal.asset !== 'USD-TDN' || proposal.money.scale !== 3)) {
    context.addIssue({ code: 'custom', message: 'Qatom USD-TDN proposals require asset USD-TDN and scale 3', path: ['money', 'scale'] });
  }
});
export const PurchaseProposalSchema = z.preprocess((input) => {
  canonicalJson(input);
  return input;
}, PurchaseProposalObjectSchema);
export type PurchaseProposal = z.infer<typeof PurchaseProposalSchema>;

export function canonicalJson(value: unknown): string {
  const active = new Set<object>();
  let nodes = 0;
  let encodedBytes = 0;
  const account = (part: string): string => {
    encodedBytes += Buffer.byteLength(part, 'utf8');
    if (encodedBytes > 262_144) throw new TypeError('Canonical value exceeds byte limit');
    return part;
  };
  const encode = (input: unknown, depth: number): string => {
    nodes += 1;
    if (nodes > 10_000 || depth > 32) throw new TypeError('Canonical value exceeds limits');
    if (typeof input === 'string' && Buffer.byteLength(input, 'utf8') > 40_000) throw new TypeError('Canonical string exceeds limit');
    if (input === null || typeof input === 'boolean' || typeof input === 'string') return account(JSON.stringify(input));
    if (typeof input === 'number') {
      if (!Number.isFinite(input) || (Number.isInteger(input) && !Number.isSafeInteger(input))) throw new TypeError('Canonical numbers must be finite and safe');
      return account(JSON.stringify(input));
    }
    if (typeof input !== 'object') throw new TypeError('Canonical value contains unsupported type');
    if (active.has(input)) throw new TypeError('Canonical value contains a cycle');
    active.add(input);
    try {
    if (Array.isArray(input)) {
      if (Object.getPrototypeOf(input) !== Array.prototype || Object.getOwnPropertySymbols(input).length) throw new TypeError('Canonical arrays must be plain and unmodified');
      const descriptors = Object.getOwnPropertyDescriptors(input);
      if (Object.entries(descriptors).some(([key, descriptor]) => key !== 'length' && (!('value' in descriptor) || !descriptor.enumerable))) throw new TypeError('Canonical arrays cannot contain accessors or hidden fields');
      const keys = Object.keys(descriptors).filter((key) => key !== 'length');
      if (keys.length !== input.length || keys.some((key, index) => key !== String(index))) throw new TypeError('Canonical arrays must be dense and unmodified');
      account('[');
      const parts = keys.map((key) => {
        const descriptor = descriptors[key];
        if (!descriptor || !('value' in descriptor)) throw new TypeError('Canonical arrays cannot contain accessors');
        return encode(descriptor.value, depth + 1);
      });
      if (parts.length > 1) account(','.repeat(parts.length - 1));
      account(']');
      return `[${parts.join(',')}]`;
    }
      const proto = Object.getPrototypeOf(input);
      if (proto !== Object.prototype && proto !== null) throw new TypeError('Canonical objects must be plain objects');
      if (Object.getOwnPropertySymbols(input).length) throw new TypeError('Canonical objects cannot contain symbol keys');
      const descriptors = Object.getOwnPropertyDescriptors(input);
      if (Object.values(descriptors).some((descriptor) => !('value' in descriptor) || !descriptor.enumerable)) throw new TypeError('Canonical objects cannot contain accessors or hidden fields');
      const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
      if (entries.some(([key]) => key === '__proto__' || key === 'constructor' || key === 'prototype')) throw new TypeError('Canonical object contains an unsafe key');
      if (entries.some(([key]) => Buffer.byteLength(key, 'utf8') > 40_000)) throw new TypeError('Canonical key exceeds limit');
      account('{');
      const parts = entries.map(([key, v]) => {
        account(JSON.stringify(key));
        account(':');
        return `${JSON.stringify(key)}:${encode(v, depth + 1)}`;
      });
      if (parts.length > 1) account(','.repeat(parts.length - 1));
      account('}');
      return `{${parts.join(',')}}`;
    } finally {
      active.delete(input);
    }
  };
  return encode(value, 0);
}

export function proposalFingerprint(input: PurchaseProposal): string {
  const proposal = parseProposal(input);
  return createHash('sha256').update(canonicalizationVersion).update('\0').update(canonicalJson(proposal)).digest('hex');
}

export function parseProposal(input: unknown): PurchaseProposal {
  return PurchaseProposalSchema.parse(input);
}

export const PaymentResultSchema = z.object({
  executionId: z.string().max(256),
  status: PaymentStatusSchema,
  platform: z.enum(['qatom', 'goat']),
  providerReference: z.string().max(512).optional(),
  actual: z.object({ itemId: z.string().min(1).max(512), money: MoneySchema, receiptId: z.string().min(1).max(512).optional() }).strict().optional(),
  reason: z.string().max(1_024).optional(),
  evidence: JsonValueSchema.optional(),
}).strict().superRefine((result, context) => {
  if (['submitting', 'succeeded', 'failed', 'pending', 'pending_approval'].includes(result.status) && !result.executionId) {
    context.addIssue({ code: 'custom', message: 'Provider outcomes require an execution ID', path: ['executionId'] });
  }
  if (result.status === 'succeeded' && (!result.actual?.receiptId || !result.actual.itemId)) {
    context.addIssue({ code: 'custom', message: 'Success requires checked provider receipt fields', path: ['actual'] });
  }
  if (result.status === 'failed' && (!result.evidence || typeof result.evidence !== 'object' || Array.isArray(result.evidence))) {
    context.addIssue({ code: 'custom', message: 'Failure requires structured terminal evidence', path: ['evidence'] });
  }
  if (result.status === 'pending_approval' && !result.providerReference) {
    context.addIssue({ code: 'custom', message: 'Provider approval requires a continuation reference', path: ['providerReference'] });
  }
});
export type PaymentResult = z.infer<typeof PaymentResultSchema>;
