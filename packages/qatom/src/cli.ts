import { collectCapabilities } from './capabilities.js';

const token = process.env.QATOM_MCP_TOKEN;
const evidence = await collectCapabilities(token ? { token } : {});
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
