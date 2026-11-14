import { z } from 'zod';

export const MoneySchema = z
  .string()
  .regex(/^\d+$/, 'Money must be a positive integer or zero represented as string in minor units');

export const CurrencySchema = z.enum([
  'USD',
  'USDC',
  'USDT',
  'GOAT',
  'ETH',
  'BTC',
]);

export const IntentSchema = z
  .object({
    id: z.string().min(1),
    owner: z.string().min(1),
    seller: z.string().min(1),
    product: z.string().min(1),
    maxAmount: MoneySchema,
    currency: CurrencySchema,
    allowedDestinations: z.array(z.string().min(1)).min(1),
    expiry: z.string().datetime(),
    remainingUses: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type Intent = z.infer<typeof IntentSchema>;

export const PurchaseProposalSchema = z
  .object({
    intentId: z.string().min(1),
    seller: z.string().min(1),
    product: z.string().min(1),
    amount: MoneySchema,
    currency: CurrencySchema,
    destination: z.string().min(1),
    sourceRef: z.string().min(1),
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
    source: z.string().min(1),
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
    id: z.string().min(1),
    proposalHash: z.string().min(1),
    decision: DecisionOutcomeSchema,
    reasonCodes: z.array(ReasonCodeSchema).min(1),
    timestamp: z.string().datetime(),
    authorizationRef: z.string().nullable().optional(),
  })
  .strict();

export type VerificationDecision = z.infer<typeof VerificationDecisionSchema>;

export const PaymentStatusSchema = z.enum(['succeeded', 'failed', 'pending_unknown']);

export const PaymentPlatformSchema = z.enum(['goat', 'qatom']);

export const PaymentResultSchema = z
  .object({
    executionId: z.string().min(1),
    status: PaymentStatusSchema,
    platform: PaymentPlatformSchema,
    txHashOrCheckoutRef: z.string().nullable(),
    error: z.string().nullable(),
  })
  .strict();

export type PaymentResult = z.infer<typeof PaymentResultSchema>;
