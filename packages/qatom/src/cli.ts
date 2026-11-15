import { createQatomClient } from './client.js';

try { process.loadEnvFile?.('.env'); } catch {}
const token = process.env.QATOM_MCP_TOKEN || process.env.QATOM_API_KEY;
let close: (() => Promise<void>) | undefined;
try {
  const client = await createQatomClient(token ? { token } : {});
  close = () => client.close();
  const tools = await client.listTools();
  process.stdout.write(`${JSON.stringify({ authenticated: Boolean(token), toolCount: tools.length, tools: tools.map(({ name }) => name) }, null, 2)}\n`);
} catch (error) {
  const status = error && typeof error === 'object'
    ? ('status' in error && typeof error.status === 'number' ? error.status : 'code' in error && typeof error.code === 'number' ? error.code : undefined)
    : undefined;
  process.stderr.write(`${JSON.stringify({ authenticated: Boolean(token), status: status ?? null, errorType: error instanceof Error ? error.name : 'UnknownError' })}\n`);
  process.exitCode = 1;
} finally {
  await close?.().catch(() => undefined);
}
