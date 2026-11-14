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
import type { DecisionView, InspectionTextInput, ProposalView } from '@/lib/types';

const REASON_CODES = new Set([
  'OK', 'INTENT_NOT_FOUND', 'INTENT_EXPIRED', 'INTENT_EXHAUSTED', 'SELLER_MISMATCH',
  'PRODUCT_MISMATCH', 'AMOUNT_EXCEEDS_MAX', 'AMOUNT_INVALID', 'CURRENCY_MISMATCH',
  'DESTINATION_NOT_ALLOWED', 'INJECTION_FLAGGED', 'SCHEMA_INVALID', 'INTERNAL_ERROR',
]);

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJsonWrite(request)) return jsonResponse({ error: 'Same-origin JSON requests are required.' }, 403);

  let input: unknown;
  try {
    input = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RequestBodyError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: 'Unable to read verification request.' }, 400);
  }

  if (!isRecord(input) || !hasOnlyKeys(input, ['proposal', 'inspectionText']) || !isProposal(input.proposal) || !isInspectionText(input.inspectionText)) {
    return jsonResponse({ error: 'Invalid proposal request.' }, 400);
  }

  const proposal = input.proposal;
  const inspectionText = input.inspectionText;
  try {
    const owner = getDemoOwnerId();
    const intentResult = await callGateway('dashboard', `/intents/${encodeURIComponent(proposal.intentId)}`);
    if (!intentResult.ok || !isRecord(intentResult.data)) return gatewayFailure(intentResult.status);
    if (intentResult.data.owner !== owner) return jsonResponse({ error: 'Authorization does not belong to this local demo owner.' }, 404);

    const scan = inspectText(inspectionText.text, 20_000, 30);
    const forwarded = {
      proposal,
      inspection: {
        source: inspectionText.source,
        // The local heuristic scanner is advisory. Its findings only request review;
        // deterministic gateway policy remains the sole decision authority.
        flags: scan.findings.map((finding) => ({ code: finding.code, severity: 'medium' as const })),
        evidence: scan.findings.map((finding) => finding.excerpt),
        findings: {
          detector: 'heuristic-text-scanner',
          detectorLimit: 'Signals are incomplete and cannot guarantee prompt-injection detection.',
          truncated: scan.truncated,
          sourceChars: scan.sourceChars,
        },
      },
    };
    const result = await callGateway('agent', '/verify', { method: 'POST', body: forwarded });
    if (!result.ok || !isRecord(result.data)) return gatewayFailure(result.status);

    const data = result.data;
    if (
      !isBoundedString(data.id, 128) || !isBoundedString(data.proposalHash, 256) ||
      (data.decision !== 'approve' && data.decision !== 'reject' && data.decision !== 'review') ||
      !Array.isArray(data.reasonCodes) || data.reasonCodes.length === 0 || data.reasonCodes.length > REASON_CODES.size ||
      !data.reasonCodes.every((code) => typeof code === 'string' && REASON_CODES.has(code)) ||
      !isIsoTimestamp(data.timestamp)
    ) {
      return jsonResponse({ error: 'Gateway returned an invalid verification response.' }, 502);
    }

    const decision: DecisionView = {
      id: data.id,
      proposalHash: data.proposalHash,
      decision: data.decision,
      reasonCodes: data.reasonCodes,
      timestamp: data.timestamp,
    };
    // Deliberately omit authorizationRef: it is a one-use capability and is not a UI value.
    return jsonResponse({
      decision,
      inspection: {
        source: inspectionText.source,
        findings: scan.findings.map((finding) => ({ code: finding.code, excerpt: finding.excerpt })),
        truncated: scan.truncated,
        sourceChars: scan.sourceChars,
        caveat: 'This heuristic scanner may miss prompt injections. Findings are advisory only; the gateway made the authorization decision.',
      },
    });
  } catch (error) {
    if (error instanceof GatewayConfigurationError) return jsonResponse({ error: error.message }, 503);
    return jsonResponse({ error: 'Gateway configuration is unavailable.' }, 503);
  }
}

function isProposal(value: unknown): value is ProposalView {
  if (!isRecord(value) || !hasOnlyKeys(value, ['intentId', 'seller', 'product', 'amount', 'currency', 'destination', 'sourceRef'])) return false;
  return isBoundedString(value.intentId, 64) && isBoundedString(value.seller, 256) &&
    isBoundedString(value.product, 256) && typeof value.amount === 'string' && /^\d{1,38}$/.test(value.amount) &&
    (value.currency === 'USDC' || value.currency === 'USDT') && isBoundedString(value.destination, 256) &&
    isBoundedString(value.sourceRef, 256);
}

function isInspectionText(value: unknown): value is InspectionTextInput {
  return isRecord(value) && hasOnlyKeys(value, ['source', 'text']) &&
    isBoundedString(value.source, 256) && typeof value.text === 'string' && value.text.length <= 20_000;
}

function gatewayFailure(status: number): Response {
  if (status === 404) return jsonResponse({ error: 'Authorization was not found in this local gateway.' }, 404);
  if (status === 401 || status === 403) return jsonResponse({ error: 'Gateway credentials are missing or rejected.' }, 502);
  if (status === 503) return jsonResponse({ error: 'Local gateway is unavailable. The decision is unconfirmed; no payment was attempted.' }, 503);
  if (status >= 500) return jsonResponse({ error: 'Gateway verification did not return a confirmed decision. No payment was attempted.' }, 502);
  return jsonResponse({ error: 'Gateway rejected the verification request.' }, status >= 400 && status < 500 ? status : 502);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(record).every((key) => keys.includes(key));
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

