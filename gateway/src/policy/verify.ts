import {
  Intent,
  PurchaseProposal,
  InspectionResult,
  ReasonCode,
  DecisionOutcome,
} from '../schemas/index.js';

export interface PolicyEvaluation {
  decision: DecisionOutcome;
  reasonCodes: ReasonCode[];
}

/**
 * Pure, deterministic verification of a proposed purchase against an intent.
 * - Injects `now` (no Date.now() / system calls)
 * - Exact matching on unchanged strings (no fuzzy logic, no LLM)
 * - BigInt integer arithmetic for minor monetary units
 * - Returns ALL applicable reason codes
 * - Hard mismatch -> reject
 * - High/critical injection flag -> reject
 * - Low/medium injection flag with otherwise clean match -> review
 * - InspectionResult can only make a decision stricter, never looser
 */
export function verifyPolicy(
  intent: Intent | null,
  proposal: PurchaseProposal,
  inspection?: InspectionResult,
  now: Date = new Date()
): PolicyEvaluation {
  const reasonCodes: ReasonCode[] = [];
  let isHardReject = false;
  let isSoftReview = false;

  // 1. Intent existence check
  if (!intent) {
    return {
      decision: 'reject',
      reasonCodes: ['INTENT_NOT_FOUND'],
    };
  }

  // 2. Expiry check: intent is invalid at the expiry instant; malformed dates fail closed.
  const expiryDate = new Date(intent.expiry);
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(expiryDate.getTime()) || now.getTime() >= expiryDate.getTime()) {
    reasonCodes.push('INTENT_EXPIRED');
    isHardReject = true;
  }

  // 3. Exhaustion check
  if (intent.remainingUses <= 0) {
    reasonCodes.push('INTENT_EXHAUSTED');
    isHardReject = true;
  }

  // 4. Seller match
  if (intent.seller !== proposal.seller) {
    reasonCodes.push('SELLER_MISMATCH');
    isHardReject = true;
  }

  // 5. Product match
  if (intent.product !== proposal.product) {
    reasonCodes.push('PRODUCT_MISMATCH');
    isHardReject = true;
  }

  // 6. Currency match
  if (intent.currency !== proposal.currency) {
    reasonCodes.push('CURRENCY_MISMATCH');
    isHardReject = true;
  }

  // 7. Amount checks (bigint in minor units)
  let propAmount: bigint;
  let maxAmount: bigint;
  try {
    propAmount = BigInt(proposal.amount);
    maxAmount = BigInt(intent.maxAmount);
  } catch {
    reasonCodes.push('AMOUNT_INVALID');
    isHardReject = true;
    propAmount = 0n;
    maxAmount = 0n;
  }

  if (propAmount <= 0n) {
    reasonCodes.push('AMOUNT_INVALID');
    isHardReject = true;
  } else if (propAmount > maxAmount) {
    reasonCodes.push('AMOUNT_EXCEEDS_MAX');
    isHardReject = true;
  }

  // 8. Destination allowed
  if (!intent.allowedDestinations.includes(proposal.destination)) {
    reasonCodes.push('DESTINATION_NOT_ALLOWED');
    isHardReject = true;
  }

  // 9. Inspection advisory check
  if (inspection && inspection.flags && inspection.flags.length > 0) {
    reasonCodes.push('INJECTION_FLAGGED');
    const hasHighOrCritical = inspection.flags.some(
      (f) => f.severity === 'high' || f.severity === 'critical'
    );
    if (hasHighOrCritical) {
      isHardReject = true;
    } else {
      isSoftReview = true;
    }
  }

  // Final outcome calculation
  if (isHardReject) {
    return {
      decision: 'reject',
      reasonCodes,
    };
  }

  if (isSoftReview) {
    return {
      decision: 'review',
      reasonCodes,
    };
  }

  return {
    decision: 'approve',
    reasonCodes: ['OK'],
  };
}
