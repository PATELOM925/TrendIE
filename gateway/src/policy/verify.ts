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

function normalize(str: string): string {
  return str.trim().normalize('NFC').toLowerCase();
}

/**
 * Pure, deterministic verification of a proposed purchase against an intent.
 * - Injects `now` (no Date.now() / system calls)
 * - Exact matching on normalized strings (no fuzzy logic, no LLM)
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

  // 2. Expiry check: exact boundary instant is ok, strictly after is expired
  const expiryDate = new Date(intent.expiry);
  if (now.getTime() > expiryDate.getTime()) {
    reasonCodes.push('INTENT_EXPIRED');
    isHardReject = true;
  }

  // 3. Exhaustion check
  if (intent.remainingUses <= 0) {
    reasonCodes.push('INTENT_EXHAUSTED');
    isHardReject = true;
  }

  // 4. Seller match
  if (normalize(intent.seller) !== normalize(proposal.seller)) {
    reasonCodes.push('SELLER_MISMATCH');
    isHardReject = true;
  }

  // 5. Product match
  if (normalize(intent.product) !== normalize(proposal.product)) {
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
  const normalizedAllowed = intent.allowedDestinations.map(normalize);
  const normalizedProposalDest = normalize(proposal.destination);
  if (!normalizedAllowed.includes(normalizedProposalDest)) {
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
