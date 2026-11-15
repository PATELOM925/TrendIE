import { z } from 'zod';

export const MoneySchema = z
  .string().max(38)
  .regex(/^\d+$/, 'Money must be a positive integer or zero represented as string in minor units');

export const CurrencySchema = z.enum([
  'USD',
  'USDC',
  'USDT',
  'GOAT',
  'ETH',
  'BTC',
  'USD-TDN',
]);

export const IntentSchema = z
  .object({
    id: z.string().min(1).max(64),
    owner: z.string().min(1).max(128),
    seller: z.string().min(1).max(256),
    product: z.string().min(1).max(256),
    maxAmount: MoneySchema,
    currency: CurrencySchema,
    allowedDestinations: z.array(z.string().min(1).max(256)).min(1).max(100),
    expiry: z.string().datetime(),
    remainingUses: z.number().int().nonnegative().max(2147483647),
    createdAt: z.string().datetime(),
    intentVersion: z.number().int().positive().optional().default(1),
    platform: z.enum(['goat', 'qatom']).optional(),
    chain: z.string().max(64).optional(),
    asset: z.string().max(32).optional(),
    scale: z.number().int().min(0).max(18).optional(),
    sender: z.string().max(256).optional(),
  })
  .strict();

export type Intent = z.infer<typeof IntentSchema>;

export const PurchaseProposalSchema = z
  .object({
    intentId: z.string().min(1).max(64),
    seller: z.string().min(1).max(256),
    product: z.string().min(1).max(256),
    amount: MoneySchema,
    currency: CurrencySchema,
    destination: z.string().min(1).max(256),
    sourceRef: z.string().min(1).max(256),
    version: z.literal(1).optional(),
    ownerId: z.string().min(1).max(256).optional(),
    intentVersion: z.number().int().positive().optional(),
    platform: z.enum(['goat', 'qatom']).optional(),
    itemId: z.string().min(1).max(512).optional(),
    sellerId: z.string().min(1).max(512).optional(),
    money: z.object({ amount: z.string(), scale: z.number().int().min(0).max(255) }).optional(),
    asset: z.string().min(1).max(64).optional(),
    chain: z.string().min(1).max(128).optional(),
    providerArgs: z.record(z.string().max(256), z.unknown()).optional(),
  })
  .strict();

export type PurchaseProposal = z.infer<typeof PurchaseProposalSchema>;

export const InspectionFlagSchema = z
  .object({
    code: z.string().min(1),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })
  .strict();

export const InspectionResultSchema = z
  .object({
    source: z.string().min(1).max(256),
    flags: z.array(InspectionFlagSchema).default([]),
    evidence: z.array(z.string()).default([]),
    findings: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type InspectionResult = z.infer<typeof InspectionResultSchema>;

export const ReasonCodeSchema = z.enum([
  'OK',
  'INTENT_NOT_FOUND',
  'INTENT_EXPIRED',
  'INTENT_EXHAUSTED',
  'INTENT_VERSION_MISMATCH',
  'PLATFORM_MISMATCH',
  'SELLER_MISMATCH',
  'PRODUCT_MISMATCH',
  'AMOUNT_EXCEEDS_MAX',
  'AMOUNT_INVALID',
  'CURRENCY_MISMATCH',
  'DESTINATION_NOT_ALLOWED',
  'INJECTION_FLAGGED',
  'SCHEMA_INVALID',
  'INTERNAL_ERROR',
]);

export type ReasonCode = z.infer<typeof ReasonCodeSchema>;

export const DecisionOutcomeSchema = z.enum(['approve', 'reject', 'review']);
export type DecisionOutcome = z.infer<typeof DecisionOutcomeSchema>;

export const VerificationDecisionSchema = z
  .object({
    id: z.string().min(1).max(64),
    proposalHash: z.string().min(1),
    decision: DecisionOutcomeSchema,
    reasonCodes: z.array(ReasonCodeSchema).min(1),
    timestamp: z.string().datetime(),
    authorizationRef: z.string().nullable().optional(),
  })
  .strict();

export type VerificationDecision = z.infer<typeof VerificationDecisionSchema>;

export const PaymentStatusSchema = z.enum(['pending_approval', 'submitting', 'pending', 'unknown', 'succeeded', 'failed', 'blocked', 'pending_unknown']);

export const PaymentPlatformSchema = z.enum(['goat', 'qatom']);

export const PaymentResultSchema = z
  .object({
    executionId: z.string().min(1).max(64),
    status: PaymentStatusSchema,
    platform: PaymentPlatformSchema,
    txHashOrCheckoutRef: z.string().max(512).nullable(),
    error: z.string().max(2048).nullable(),
    evidence: z.record(z.string(), z.unknown()).refine((v) => JSON.stringify(v).length <= 16384, 'Evidence must be at most 16 KiB'),
  })
  .strict();

export type PaymentResult = z.infer<typeof PaymentResultSchema>;
