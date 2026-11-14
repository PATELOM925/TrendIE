import {
  callGateway,
  getDemoOwnerId,
  GatewayConfigurationError,
  isSameOriginJsonWrite,
  jsonResponse,
  readJsonBody,
  RequestBodyError,
} from '@/lib/gateway-server';
import { parseTokenAmount } from '@/lib/money';
import type { DemoCurrency, IntentView } from '@/lib/types';

type RawIntent = {
  id?: unknown;
  owner?: unknown;
  seller?: unknown;
  product?: unknown;
  maxAmount?: unknown;
  currency?: unknown;
  allowedDestinations?: unknown;
  expiry?: unknown;
  remainingUses?: unknown;
  createdAt?: unknown;
};

export async function GET(): Promise<Response> {
  try {
    const owner = getDemoOwnerId();
    const result = await callGateway('dashboard', '/intents');
    if (!result.ok || !isRecord(result.data) || !Array.isArray(result.data.intents)) {
      return gatewayFailure(result.status);
    }

    const intents = result.data.intents
      .map((item) => toIntentView(item as RawIntent, owner))
      .filter((item): item is IntentView => item !== null);
    return jsonResponse({ intents });
  } catch (error) {
    return configurationFailure(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJsonWrite(request)) return jsonResponse({ error: 'Same-origin JSON requests are required.' }, 403);

  let input: unknown;
  try {
    input = await readJsonBody(request);
  } catch (error) {
    return bodyFailure(error);
  }

  if (!isRecord(input) || !hasOnlyKeys(input, ['requestId', 'seller', 'product', 'amount', 'currency', 'destination', 'expiry'])) {
    return jsonResponse({ error: 'Invalid authorization request.' }, 400);
  }

  const requestId = asString(input.requestId, 36);
  const seller = asString(input.seller, 256)?.trim();
  const product = asString(input.product, 256)?.trim();
  const amount = asString(input.amount, 64);
  const currency = input.currency;
  const destination = asString(input.destination, 256)?.trim();
  const expiry = asString(input.expiry, 64);
  if (
    !requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ||
    !seller || !product || !destination ||
    (currency !== 'USDC' && currency !== 'USDT') ||
    !amount || !expiry
  ) {
    return jsonResponse({ error: 'Enter a seller, product, positive token amount, destination, currency, and expiry.' }, 400);
  }

  const maxAmount = parseTokenAmount(amount);
  const expiryTime = Date.parse(expiry);
  if (!maxAmount) return jsonResponse({ error: 'Amount must be positive and use at most six decimal places.' }, 400);
  if (!Number.isFinite(expiryTime) || expiryTime <= Date.now()) {
    return jsonResponse({ error: 'Authorization expiry must be in the future.' }, 400);
  }

  try {
    const owner = getDemoOwnerId();
    const id = `int_${requestId.replaceAll('-', '')}`;
    const intent = {
      id,
      owner,
      seller,
      product,
      maxAmount,
      currency: currency as DemoCurrency,
      allowedDestinations: [destination],
      expiry: new Date(expiryTime).toISOString(),
      remainingUses: 1,
      createdAt: new Date().toISOString(),
    };

    const result = await callGateway('dashboard', '/intents', { method: 'POST', body: intent });
    if (result.ok) {
      const created = toIntentView(result.data as RawIntent, owner);
      if (!created) return jsonResponse({ error: 'Gateway returned an invalid authorization record.' }, 502);
      return jsonResponse({ intent: created }, result.status === 201 ? 201 : 200);
    }

    if (result.status === 409) {
      const existing = await callGateway('dashboard', `/intents/${encodeURIComponent(id)}`);
      const existingIntent = toIntentView(existing.data as RawIntent, owner);
      if (existing.ok && existingIntent && sameIntent(existingIntent, intent)) {
        return jsonResponse({ intent: existingIntent }, 200);
      }
      return jsonResponse({ error: 'An authorization with this request ID already exists.' }, 409);
    }

    return gatewayFailure(result.status);
  } catch (error) {
    return configurationFailure(error);
  }
}

function toIntentView(input: RawIntent, owner: string): IntentView | null {
  const destinations = input.allowedDestinations;
  if (
    input.owner !== owner ||
    !isString(input.id) || !isString(input.seller) || !isString(input.product) ||
    !isString(input.maxAmount) || !/^\d{1,38}$/.test(input.maxAmount) ||
    (input.currency !== 'USDC' && input.currency !== 'USDT') ||
    !Array.isArray(destinations) || !destinations.every(isString) ||
    !isString(input.expiry) || !isString(input.createdAt) ||
    typeof input.remainingUses !== 'number' || !Number.isInteger(input.remainingUses)
  ) return null;

  return {
    id: input.id,
    seller: input.seller,
    product: input.product,
    maxAmount: input.maxAmount,
    currency: input.currency,
    allowedDestinations: destinations,
    expiry: input.expiry,
    remainingUses: input.remainingUses,
    createdAt: input.createdAt,
  };
}

function sameIntent(existing: IntentView, expected: {
  id: string;
  seller: string;
  product: string;
  maxAmount: string;
  currency: DemoCurrency;
  allowedDestinations: string[];
  expiry: string;
  remainingUses: number;
}): boolean {
  return existing.id === expected.id && existing.seller === expected.seller && existing.product === expected.product &&
    existing.maxAmount === expected.maxAmount && existing.currency === expected.currency &&
    existing.allowedDestinations.length === expected.allowedDestinations.length &&
    existing.allowedDestinations.every((item, index) => item === expected.allowedDestinations[index]) &&
    existing.expiry === expected.expiry && existing.remainingUses === expected.remainingUses;
}

function gatewayFailure(status: number): Response {
  if (status === 401 || status === 403) return jsonResponse({ error: 'Gateway credentials are missing or rejected.' }, 502);
  if (status === 503) return jsonResponse({ error: 'Local gateway is unavailable. Start it and check its local configuration.' }, 503);
  return jsonResponse({ error: 'Gateway could not complete the authorization request.' }, status >= 400 && status < 500 ? status : 502);
}

function configurationFailure(error: unknown): Response {
  if (error instanceof GatewayConfigurationError) return jsonResponse({ error: error.message }, 503);
  return jsonResponse({ error: 'Gateway configuration is unavailable.' }, 503);
}

function bodyFailure(error: unknown): Response {
  if (error instanceof RequestBodyError) return jsonResponse({ error: error.message }, error.status);
  return jsonResponse({ error: 'Unable to read authorization request.' }, 400);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(record).every((key) => keys.includes(key));
}

function asString(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.length <= maxLength ? value : null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
