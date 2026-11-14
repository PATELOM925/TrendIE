import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { canonicalJson } from '@trendie/contracts';

export const QATOM_ENDPOINT = 'https://mcp.m.todaq.net/mcp';
const MAX_TOOL_COUNT = 200;
const MAX_SCHEMA_BYTES = 128_000;
const MAX_MCP_RESPONSE_BYTES = 262_144;

export interface ToolDescription {
  name: string;
  description?: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  annotations?: { readOnlyHint?: boolean };
}

export interface QatomReadClient {
  listTools(): Promise<ToolDescription[]>;
  catalogSearch(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export interface QatomMcpTransport extends QatomReadClient {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  continueTool(providerReference: string): Promise<unknown>;
}

export async function createQatomClient(options: {
  token?: string;
  endpoint?: string;
} = {}): Promise<QatomMcpTransport> {
  const url = new URL(options.endpoint ?? QATOM_ENDPOINT);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('Qatom endpoint must use HTTPS');
  if (url.toString().replace(/\/$/, '') !== QATOM_ENDPOINT && url.hostname !== 'localhost') throw new Error('Only the official Qatom endpoint or localhost is allowed');
  if (options.token && url.hostname === 'localhost') throw new Error('Bearer token cannot be sent to localhost');
  const headers = new Headers();
  if (options.token) headers.set('authorization', `Bearer ${options.token}`);
  const client = new Client({ name: 'trendie-qpe', version: '0.1.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers },
    fetch: boundedFetch,
    reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 0, maxReconnectionDelay: 0, reconnectionDelayGrowFactor: 1 },
  });
  try { await client.connect(transport); }
  catch (error) { throw sanitizedError('Qatom MCP connection failed', error); }
  return {
    async listTools() {
      let response;
      try { response = await client.listTools(); }
      catch (error) { throw sanitizedError('Qatom tool inventory failed', error); }
      if (response.tools.length > MAX_TOOL_COUNT) throw new Error('Qatom tool list exceeds limit');
      const serialized = JSON.stringify(response.tools);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_SCHEMA_BYTES) throw new Error('Qatom tool schemas exceed limit');
      return response.tools.map((tool) => ({
        name: tool.name,
        ...(tool.description ? { description: tool.description.slice(0, 2_000) } : {}),
        inputSchema: tool.inputSchema,
        ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
        ...(tool.annotations ? { annotations: { ...(tool.annotations.readOnlyHint === undefined ? {} : { readOnlyHint: tool.annotations.readOnlyHint }) } } : {}),
      }));
    },
    async catalogSearch(name, args) {
      if (name !== 'catalog_search') throw new Error('Only the explicitly read-only catalog_search tool is allowed');
      const encodedArgs = canonicalJson(args);
      if (Buffer.byteLength(encodedArgs, 'utf8') > MAX_SCHEMA_BYTES) throw new Error('Qatom catalog arguments exceed limit');
      let response;
      try { response = await client.listTools(); }
      catch (error) { throw sanitizedError('Qatom tool inventory failed', error); }
      if (!response.tools.some((tool) => tool.name === name && tool.annotations?.readOnlyHint === true)) throw new Error('Qatom catalog_search is not verified read-only');
      let result;
      try { result = await client.callTool({ name, arguments: args }); }
      catch (error) { throw sanitizedError('Qatom catalog search failed', error); }
      if (result.isError) throw new Error('Qatom catalog search returned a tool error');
      const serialized = JSON.stringify(result);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_SCHEMA_BYTES) throw new Error('Qatom catalog response exceeds limit');
      return result;
    },
    async callTool(name) {
      throw new Error(`Write-capable tool ${name} is not available through the read-only client`);
    },
    async continueTool() {
      throw new Error('Qatom continuation is unavailable through the read-only client');
    },
    async close() { await client.close(); },
  };
}

const boundedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, { ...init, redirect: 'error' });
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MCP_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error('Qatom MCP response exceeds limit');
  }
  if (!response.body) return response;
  const reader = response.body.getReader();
  let total = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) { controller.close(); return; }
        total += chunk.value.byteLength;
        if (total > MAX_MCP_RESPONSE_BYTES) {
          await reader.cancel();
          controller.error(new Error('Qatom MCP response exceeds limit'));
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) { controller.error(error); }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
};

function sanitizedError(message: string, error: unknown): Error {
  const safe = new Error(message);
  if (error && typeof error === 'object') {
    const code = 'code' in error && typeof error.code === 'number' ? error.code : 'status' in error && typeof error.status === 'number' ? error.status : undefined;
    if (code !== undefined) Object.assign(safe, { code });
  }
  return safe;
}
