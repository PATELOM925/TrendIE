import {
  isSameOriginJsonWrite,
  jsonResponse,
  readJsonBody,
  RequestBodyError,
} from '@/lib/gateway-server';
import { getOwnedIntent, verificationErrorResponse, verifyProposalWithGateway } from '@/lib/gateway-verification';
import type { InspectionTextInput, ProposalView } from '@/lib/types';

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJsonWrite(request)) return jsonResponse({ error: 'Same-origin JSON requests are required.' }, 403);

  let input: unknown;
  try {
    input = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RequestBodyError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: 'Unable to read verification request.' }, 400);
  }

  if (!isRecord(input) || !hasOnlyKeys(input, ['proposal', 'inspectionText']) || !isProposal(input.proposal) || !isInspectionText(input.inspectionText) ||
      isUploadedPdfReference(input.inspectionText.source) || isUploadedPdfReference(input.proposal.sourceRef)) {
    return jsonResponse({ error: 'Invalid proposal request.' }, 400);
  }

  const proposal = input.proposal;
  const inspectionText = input.inspectionText;
  try {
    await getOwnedIntent(proposal.intentId);
    const verification = await verifyProposalWithGateway(proposal, inspectionText);
    // Deliberately omit authorizationRef: it is a one-use capability and is not a UI value.
    return jsonResponse(verification);
  } catch (error) {
    return verificationErrorResponse(error);
  }
}

function isUploadedPdfReference(value: string): boolean {
  return /^uploaded-pdf:/i.test(value);
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

function hasOnlyKeys(record: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(record).every((key) => keys.includes(key));
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength && value.trim() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

