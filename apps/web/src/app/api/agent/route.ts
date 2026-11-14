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
import { createGeminiModel } from '@trendie/agent';
import type { DecisionView, DemoCurrency, ProposalView } from '@/lib/types';

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

  const intentId = typeof input.intentId === 'string' ? input.intentId.trim() : '';
  const untrustedText = typeof input.untrustedText === 'string' ? input.untrustedText.trim() : '';
  const seller = typeof input.seller === 'string' && input.seller.trim() ? input.seller.trim() : 'Supplier A';
  const product = typeof input.product === 'string' && input.product.trim() ? input.product.trim() : 'Product A';
  const amount = typeof input.amount === 'string' && /^\d+$/.test(input.amount.trim()) ? input.amount.trim() : '100';
  const currency = (input.currency === 'USDT' ? 'USDT' : 'USDC') as DemoCurrency;
  const destination = typeof input.destination === 'string' && input.destination.trim() ? input.destination.trim() : '0xSupplierA_Contract_or_Wallet_001';
  const useLiveModel = Boolean(input.useLiveModel);

  if (!intentId) {
    return jsonResponse({ error: 'An intentId is required.' }, 400);
  }
  if (!untrustedText) {
    return jsonResponse({ error: 'Untrusted text or prompt is required.' }, 400);
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

    let effectiveSeller = seller;
    let effectiveAmount = amount;
    let effectiveDestination = destination;
    let effectiveCurrency = currency;
    let agentModelName = 'custom-payload';

    if (useLiveModel) {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        return jsonResponse({ error: 'GEMINI_API_KEY is not configured in .env.local.' }, 500);
      }

      agentModelName = 'gemini-3.5-flash';
      const gemini = createGeminiModel({ apiKey, modelName: 'gemini-3.5-flash' });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      try {
        const candidateListing = {
          itemId: 'listing-custom-01',
          sellerId: seller,
          title: product,
          amount,
          scale: 6,
          asset: currency,
          description: `Payout destination: ${destination}. ${untrustedText}`,
          sourceRef: 'user-playground-listing',
        };

        const rawProposal = await gemini.propose({
          task: `Find and purchase ${product} from ${seller} within spending limits.`,
          listings: [candidateListing],
          signal: controller.signal,
          maxTurns: 1,
          maxToolCalls: 1,
        }) as {
          itemId: string;
          sellerId: string;
          money: { amount: string; scale: number };
          asset: string;
          providerArgs: Record<string, unknown>;
        };

        effectiveSeller = rawProposal.sellerId;
        effectiveAmount = rawProposal.money.amount;
        effectiveCurrency = (rawProposal.asset === 'USDT' ? 'USDT' : 'USDC') as DemoCurrency;
        if (typeof rawProposal.providerArgs?.recipient === 'string') {
          effectiveDestination = rawProposal.providerArgs.recipient;
        }
      } catch (err: unknown) {
        clearTimeout(timeout);
        return jsonResponse({
          error: `Live Gemini agent execution failed: ${err instanceof Error ? err.message : String(err)}`,
        }, 502);
      } finally {
        clearTimeout(timeout);
      }
    }

    const proposal: ProposalView = {
      intentId,
      seller: effectiveSeller,
      product,
      amount: effectiveAmount,
      currency: effectiveCurrency,
      destination: effectiveDestination,
      sourceRef: useLiveModel ? 'live-gemini-agent-proposal' : 'custom-playground-proposal',
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
    if (!result.ok || !isRecord(result.data)) {
      return jsonResponse({ error: 'Gateway verification did not return a confirmed decision.' }, 502);
    }

    const decision: DecisionView = {
      id: String(result.data.id ?? ''),
      proposalHash: String(result.data.proposalHash ?? ''),
      decision: result.data.decision as DecisionView['decision'],
      reasonCodes: Array.isArray(result.data.reasonCodes) ? result.data.reasonCodes.map(String) : [],
      timestamp: String(result.data.timestamp ?? new Date().toISOString()),
    };

    return jsonResponse({
      decision,
      proposal,
      agentType: agentModelName,
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
