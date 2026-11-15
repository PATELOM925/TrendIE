import { createHash } from 'node:crypto';
import { QATOM_ENDPOINT, createQatomClient, type ToolDescription } from './client.js';

export interface CapabilityEvidence {
  endpoint: string;
  observedAt: string;
  authenticated: boolean;
  status: number | null;
  authChallenge: boolean;
  toolInventory: 'available' | 'unavailable' | 'malformed' | 'oversized';
  tools: Array<{ name: string; schemaFingerprint: string; readOnly: boolean | null }>;
  checkout: { toolPresent: boolean; atomicPriceCurrencyBinding: 'unknown'; receiptGuarantee: 'unknown' };
}

export async function collectCapabilities(options: { token?: string; endpoint?: string; observedAt?: string; clientFactory?: typeof createQatomClient } = {}): Promise<CapabilityEvidence> {
  const endpoint = safeEndpoint(options.endpoint ?? QATOM_ENDPOINT);
  const authenticated = Boolean(options.token);
  const evidence: CapabilityEvidence = {
    endpoint, observedAt: options.observedAt ?? new Date().toISOString(), authenticated,
    status: null, authChallenge: false, toolInventory: 'unavailable', tools: [],
    checkout: { toolPresent: false, atomicPriceCurrencyBinding: 'unknown', receiptGuarantee: 'unknown' },
  };
  let client;
  try {
    client = await (options.clientFactory ?? createQatomClient)(options.token ? { token: options.token, endpoint } : { endpoint });
    const tools = await client.listTools();
    if (!Array.isArray(tools)) { evidence.toolInventory = 'malformed'; return evidence; }
    try { evidence.tools = tools.map((tool) => safeToolEvidence(tool)); }
    catch (error) {
      evidence.toolInventory = error instanceof OversizedSchemaError ? 'oversized' : 'malformed';
      return evidence;
    }
    evidence.toolInventory = 'available';
    evidence.checkout.toolPresent = tools.some((tool) => tool.name === 'agent_checkout');
  } catch (error) {
    const candidate = error && typeof error === 'object' ? ('status' in error && typeof error.status === 'number' ? error.status : 'code' in error && typeof error.code === 'number' ? error.code : null) : null;
    const status = candidate !== null && Number.isInteger(candidate) && candidate >= 100 && candidate <= 599 ? candidate : null;
    evidence.status = status;
    evidence.authChallenge = status === 401 || status === 403;
  } finally { await client?.close().catch(() => undefined); }
  return evidence;
}

function safeToolEvidence(tool: ToolDescription) {
  if (!tool || typeof tool !== 'object') throw new Error('Malformed tool schema');
  const name = typeof tool?.name === 'string' && /^[a-zA-Z0-9_.-]{1,128}$/.test(tool.name) ? tool.name : 'invalid-tool-name';
  const schema = JSON.stringify(tool?.inputSchema);
  if (!schema) throw new Error('Malformed tool schema');
  if (Buffer.byteLength(schema, 'utf8') > 128_000) throw new OversizedSchemaError();
  return { name, schemaFingerprint: createHash('sha256').update(schema).digest('hex'), readOnly: typeof tool.annotations?.readOnlyHint === 'boolean' ? tool.annotations.readOnlyHint : null };
}

class OversizedSchemaError extends Error {}

function safeEndpoint(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch { return 'invalid-endpoint'; }
}
