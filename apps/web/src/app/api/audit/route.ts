import {
  callGateway,
  getDemoOwnerId,
  GatewayConfigurationError,
  jsonResponse,
} from '@/lib/gateway-server';
import type { IntentView, SafeAuditEntry } from '@/lib/types';

type AuditRow = {
  event_type?: unknown;
  entity_type?: unknown;
  entity_id?: unknown;
  created_at?: unknown;
  payload?: unknown;
};

export async function GET(): Promise<Response> {
  try {
    const owner = getDemoOwnerId();
    const intentResult = await callGateway('dashboard', '/intents');

    if (!intentResult.ok || !isRecord(intentResult.data) || !Array.isArray(intentResult.data.intents)) {
      return gatewayFailure(intentResult.status);
    }
    const ownedIntents = intentResult.data.intents
      .map((raw) => readOwnedIntent(raw, owner))
      .filter((intent): intent is IntentView => intent !== null)
      .slice(0, 20);
    const auditResults = await Promise.all(ownedIntents.map((intent) =>
      callGateway('dashboard', `/audit?intentId=${encodeURIComponent(intent.id)}`)
    ));
    const failedResult = auditResults.find((result) => !result.ok || !Array.isArray(result.data));
    if (failedResult) return gatewayFailure(failedResult.status);

    const ownedIntentIds = new Set(ownedIntents.map((intent) => intent.id));
    const entries: SafeAuditEntry[] = auditResults.flatMap((auditResult) =>
      (auditResult.data as AuditRow[])
      .filter((row) => row.event_type === 'INTENT_CREATED' && row.entity_type === 'intent' &&
        typeof row.entity_id === 'string' && ownedIntentIds.has(row.entity_id))
      .flatMap((row) => {
        const payload = isRecord(row.payload) ? row.payload : null;
        if (!payload || typeof row.entity_id !== 'string' || typeof row.created_at !== 'string') return [];
        const title = safeText(payload.seller, 256);
        const product = safeText(payload.product, 256);
        if (!title || !product) return [];
        return [{
          id: row.entity_id,
          kind: 'intent' as const,
          title: `Authorization created · ${title}`,
          detail: product,
          timestamp: row.created_at,
        }];
      })
    ).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

    return jsonResponse({ entries });
  } catch (error) {
    if (error instanceof GatewayConfigurationError) return jsonResponse({ error: error.message }, 503);
    return jsonResponse({ error: 'Gateway configuration is unavailable.' }, 503);
  }
}

function readOwnedIntent(value: unknown, owner: string): IntentView | null {
  if (!isRecord(value) || value.owner !== owner || typeof value.id !== 'string') return null;
  return {
    id: value.id,
    seller: typeof value.seller === 'string' ? value.seller : '',
    product: typeof value.product === 'string' ? value.product : '',
    maxAmount: typeof value.maxAmount === 'string' ? value.maxAmount : '',
    currency: value.currency === 'USDT' ? 'USDT' : 'USDC',
    allowedDestinations: Array.isArray(value.allowedDestinations) ? value.allowedDestinations.filter((item): item is string => typeof item === 'string') : [],
    expiry: typeof value.expiry === 'string' ? value.expiry : '',
    remainingUses: typeof value.remainingUses === 'number' ? value.remainingUses : 0,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
  };
}

function safeText(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : null;
}

function gatewayFailure(status: number): Response {
  if (status === 401 || status === 403) return jsonResponse({ error: 'Gateway credentials are missing or rejected.' }, 502);
  if (status === 503) return jsonResponse({ error: 'Local gateway is unavailable.' }, 503);
  return jsonResponse({ error: 'Gateway audit data is unavailable.' }, status >= 400 && status < 500 ? status : 502);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
