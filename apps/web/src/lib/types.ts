export type DemoCurrency = 'USDC' | 'USDT';

export type IntentView = {
  id: string;
  seller: string;
  product: string;
  maxAmount: string;
  currency: DemoCurrency;
  allowedDestinations: string[];
  expiry: string;
  remainingUses: number;
  createdAt: string;
};

export type Decision = 'approve' | 'reject' | 'review';
export type DecisionState = 'blocked' | 'approved' | 'needs_review';

export type DecisionView = {
  id: string;
  proposalHash: string;
  decision: Decision;
  reasonCodes: string[];
  timestamp: string;
};

export type ProposalView = {
  intentId: string;
  seller: string;
  product: string;
  amount: string;
  currency: DemoCurrency;
  destination: string;
  sourceRef: string;
};

export type InspectionTextInput = { source: string; text: string };

export type SessionActivity = {
  id: string;
  kind: 'intent' | 'decision';
  title: string;
  detail: string;
  timestamp: string;
  decision?: Decision;
};

export type SafeAuditEntry = {
  id: string;
  kind: 'intent';
  title: string;
  detail: string;
  timestamp: string;
};
