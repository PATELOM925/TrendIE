import {
  callGateway,
  getDemoOwnerId,
  GatewayConfigurationError,
  jsonResponse,
} from '@/lib/gateway-server';
import { inspectText } from '@trendie/inspection';
import type { DecisionView, DemoCurrency, InspectionTextInput, IntentView, ProposalView } from '@/lib/types';

const REASON_CODES = new Set([
  'OK', 'INTENT_NOT_FOUND', 'INTENT_EXPIRED', 'INTENT_EXHAUSTED', 'SELLER_MISMATCH',
  'PRODUCT_MISMATCH', 'AMOUNT_EXCEEDS_MAX', 'AMOUNT_INVALID', 'CURRENCY_MISMATCH',
  'DESTINATION_NOT_ALLOWED', 'INJECTION_FLAGGED', 'SCHEMA_INVALID', 'INTERNAL_ERROR',
]);

const DECISIONS = new Set(['approve', 'reject', 'review']);

export class VerificationRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'VerificationRequestError';
  }
}

export async function getOwnedIntent(intentId: string): Promise<IntentView> {
  const owner = getDemoOwnerId();
  const result = await callGateway('dashboard', `/intents/${encodeURIComponent(intentId)}`);
  if (!result.ok || !isRecord(result.data)) throw gatewayFailure(result.status);
  const value = result.data;
  if (value.owner !== owner || value.id !== intentId) {
    throw new VerificationRequestError(404, 'Authorization was not found for this local demo owner.');
  }

  const currency = value.currency;
  if (currency !== 'USDC' && currency !== 'USDT') {
    throw new VerificationRequestError(409, 'This local console supports only its USDC/USDT demo profile.');
  }
  if (!isBoundedString(value.seller, 256) || !isBoundedString(value.product, 256) ||
      typeof value.maxAmount !== 'string' || !/^\d{1,38}$/.test(value.maxAmount) ||
      !Array.isArray(value.allowedDestinations) || !value.allowedDestinations.every((item) => isBoundedString(item, 256)) ||
      !isBoundedString(value.expiry, 64) || typeof value.remainingUses !== 'number' || !Number.isInteger(value.remainingUses) ||
      !isBoundedString(value.createdAt, 64)) {
    throw new VerificationRequestError(502, 'Gateway returned an invalid authorization record.');
  }

  return {
    id: intentId,
    seller: value.seller,
    product: value.product,
    maxAmount: value.maxAmount,
    currency: currency as DemoCurrency,
    allowedDestinations: value.allowedDestinations,
    expiry: value.expiry,
    remainingUses: value.remainingUses,
    createdAt: value.createdAt,
  };
}

export async function verifyProposalWithGateway(
  proposal: ProposalView,
  inspectionText: InspectionTextInput,
  sourceEvidence: { truncated?: boolean; sourceChars?: number } = {},
): Promise<{ decision: DecisionView; inspection: {
  source: string;
  findings: Array<{ code: string; excerpt: string }>;
  truncated: boolean;
  sourceChars: number;
  caveat: string;
} }> {
  const scan = inspectText(inspectionText.text, 20_000, 30);
  const truncated = scan.truncated || sourceEvidence.truncated === true;
  const sourceChars = sourceEvidence.sourceChars ?? scan.sourceChars;
  const forwarded = {
    proposal,
    inspection: {
      source: inspectionText.source,
      flags: scan.findings.map((finding) => ({ code: finding.code, severity: 'medium' as const })),
      evidence: scan.findings.map((finding) => finding.excerpt),
      findings: {
        detector: 'heuristic-text-scanner',
        detectorLimit: 'Signals are incomplete and cannot guarantee prompt-injection detection.',
        truncated,
        sourceChars,
      },
    },
  };
  const result = await callGateway('agent', '/verify', { method: 'POST', body: forwarded });
  if (!result.ok || !isRecord(result.data)) throw gatewayFailure(result.status);
  const data = result.data;
  if (!isBoundedString(data.id, 128) || !isBoundedString(data.proposalHash, 256) ||
      typeof data.decision !== 'string' || !DECISIONS.has(data.decision) ||
      !Array.isArray(data.reasonCodes) || data.reasonCodes.length === 0 || data.reasonCodes.length > REASON_CODES.size ||
      !data.reasonCodes.every((code) => typeof code === 'string' && REASON_CODES.has(code)) ||
      !isIsoTimestamp(data.timestamp)) {
    throw new VerificationRequestError(502, 'Gateway returned an invalid verification response.');
  }

  return {
    decision: {
      id: data.id,
      proposalHash: data.proposalHash,
      decision: data.decision as DecisionView['decision'],
      reasonCodes: data.reasonCodes,
      timestamp: data.timestamp,
    },
    inspection: {
      source: inspectionText.source,
      findings: scan.findings.map((finding) => ({ code: finding.code, excerpt: finding.excerpt })),
      truncated,
      sourceChars,
      caveat: 'This heuristic scanner may miss prompt injections. Findings are advisory only; the gateway made the authorization decision.',
    },
  };
}

export function verificationErrorResponse(error: unknown): Response {
  if (error instanceof VerificationRequestError) return jsonResponse({ error: error.message }, error.status);
  if (error instanceof GatewayConfigurationError) return jsonResponse({ error: error.message }, 503);
  return jsonResponse({ error: 'Gateway configuration is unavailable.' }, 503);
}

function gatewayFailure(status: number): VerificationRequestError {
  if (status === 404) return new VerificationRequestError(404, 'Authorization was not found in this local gateway.');
  if (status === 401 || status === 403) return new VerificationRequestError(502, 'Gateway credentials are missing or rejected.');
  if (status === 503) return new VerificationRequestError(503, 'Local gateway is unavailable. The decision is unconfirmed; no payment was attempted.');
  if (status >= 500) return new VerificationRequestError(502, 'Gateway verification did not return a confirmed decision. No payment was attempted.');
  return new VerificationRequestError(status >= 400 ? status : 502, 'Gateway verification did not return a confirmed decision.');
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength && value.trim() === value;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  const fraction = value.match(/\.(\d{1,3})Z$/)?.[1] ?? '';
  const canonical = `${value.slice(0, 19)}.${fraction.padEnd(3, '0')}Z`;
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === canonical;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
