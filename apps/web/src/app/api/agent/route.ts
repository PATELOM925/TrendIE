import {
  callGateway,
  getDemoOwnerId,
  GatewayConfigurationError,
  isSameOriginJsonWrite,
  jsonResponse,
  readJsonBody,
  RequestBodyError,
} from '@/lib/gateway-server';
import { inspectText } from '@trendie/inspection';
import type { DecisionView, DemoCurrency, ProposalView } from '@/lib/types';

const REASON_CODES = new Set([
  'OK', 'INTENT_NOT_FOUND', 'INTENT_EXPIRED', 'INTENT_EXHAUSTED', 'SELLER_MISMATCH',
  'PRODUCT_MISMATCH', 'AMOUNT_EXCEEDS_MAX', 'AMOUNT_INVALID', 'CURRENCY_MISMATCH',
  'DESTINATION_NOT_ALLOWED', 'INJECTION_FLAGGED', 'SCHEMA_INVALID', 'INTERNAL_ERROR',
]);

const DECISIONS = new Set(['approve', 'reject', 'review']);

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJsonWrite(request)) {
    return jsonResponse({ error: 'Same-origin JSON requests are required.' }, 403);
  }

  let input: unknown;
  try {
    input = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RequestBodyError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: 'Unable to read agent request.' }, 400);
  }

  if (!isRecord(input)) {
    return jsonResponse({ error: 'Invalid agent request body.' }, 400);
  }

  if (!hasOnlyKeys(input, ['intentId', 'untrustedText', 'seller', 'product', 'amount', 'currency', 'destination', 'useLiveModel'])) {
    return jsonResponse({ error: 'Unknown agent request field.' }, 400);
  }
  if (input.useLiveModel === true) {
    return jsonResponse({ error: 'Live model calls are disabled until a separate numeric spend limit is approved and enforced.' }, 503);
  }
  if (input.useLiveModel !== undefined && input.useLiveModel !== false) {
    return jsonResponse({ error: 'useLiveModel must be false.' }, 400);
  }

  const intentId = input.intentId;
  const untrustedText = input.untrustedText;
  const seller = input.seller;
  const product = input.product;
  const amount = input.amount;
  const currency = input.currency;
  const destination = input.destination;
  if (!isBoundedString(intentId, 64) || !isBoundedString(untrustedText, 20_000) ||
      !isBoundedString(seller, 256) || !isBoundedString(product, 256) ||
      typeof amount !== 'string' || !/^\d{1,38}$/.test(amount) || BigInt(amount) <= 0n ||
      (currency !== 'USDC' && currency !== 'USDT') || !isBoundedString(destination, 256)) {
    return jsonResponse({ error: 'Invalid synthetic proposal request.' }, 400);
  }

  try {
    const owner = getDemoOwnerId();
    const intentResult = await callGateway('dashboard', `/intents/${encodeURIComponent(intentId)}`);
    if (!intentResult.ok || !isRecord(intentResult.data)) {
      return jsonResponse({ error: 'Authorization was not found in this local gateway.' }, 404);
    }
    if (intentResult.data.owner !== owner) {
      return jsonResponse({ error: 'Authorization does not belong to this local demo owner.' }, 404);
    }

    const proposal: ProposalView = {
      intentId,
      seller,
      product,
      amount,
      currency: currency as DemoCurrency,
      destination,
      sourceRef: 'custom-playground-proposal',
    };

    const scan = inspectText(untrustedText, 20_000, 30);
    const forwarded = {
      proposal,
      inspection: {
        source: 'custom-playground-input',
        flags: scan.findings.map((f) => ({ code: f.code, severity: 'medium' as const })),
        evidence: scan.findings.map((f) => f.excerpt),
        findings: {
          detector: 'heuristic-text-scanner',
          detectorLimit: 'Signals are incomplete and cannot guarantee prompt-injection detection.',
          truncated: scan.truncated,
          sourceChars: scan.sourceChars,
        },
      },
    };

    const result = await callGateway('agent', '/verify', { method: 'POST', body: forwarded });
    if (!result.ok || !isRecord(result.data) || !isDecisionResponse(result.data)) {
      return jsonResponse({ error: 'Gateway verification did not return a confirmed decision.' }, 502);
    }

    const decision: DecisionView = {
      id: result.data.id,
      proposalHash: result.data.proposalHash,
      decision: result.data.decision,
      reasonCodes: result.data.reasonCodes,
      timestamp: result.data.timestamp,
    };

    return jsonResponse({
      decision,
      proposal,
      agentType: 'custom-payload',
      inspection: {
        source: 'playground',
        findings: scan.findings,
        truncated: scan.truncated,
        sourceChars: scan.sourceChars,
        caveat: 'Advisory inspection scanner signals. Deterministic gateway policy made the final authorization decision.',
      },
    });
  } catch (error) {
    if (error instanceof GatewayConfigurationError) return jsonResponse({ error: error.message }, 503);
    return jsonResponse({ error: 'Internal gateway error.' }, 500);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(record).every((key) => keys.includes(key));
}

function isDecisionResponse(value: Record<string, unknown>): value is Record<string, unknown> & {
  id: string;
  proposalHash: string;
  decision: DecisionView['decision'];
  reasonCodes: string[];
  timestamp: string;
} {
  return isBoundedString(value.id, 128) && isBoundedString(value.proposalHash, 256) &&
    typeof value.decision === 'string' && DECISIONS.has(value.decision) &&
    Array.isArray(value.reasonCodes) && value.reasonCodes.length > 0 && value.reasonCodes.length <= REASON_CODES.size &&
    value.reasonCodes.every((code) => typeof code === 'string' && REASON_CODES.has(code)) &&
    isIsoTimestamp(value.timestamp);
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
