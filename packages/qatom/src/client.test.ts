import { describe, expect, it } from 'vitest';
import { createQatomClient } from './client.js';

describe('Qatom client boundary', () => {
  it('rejects arbitrary remote endpoints before network access', async () => {
    await expect(createQatomClient({ endpoint: 'https://example.invalid/mcp' })).rejects.toThrow('Only the official Qatom endpoint or localhost is allowed');
  });

  it('never sends a bearer token to a local endpoint', async () => {
    await expect(createQatomClient({ endpoint: 'http://localhost:1234/mcp', token: 'fake-token' })).rejects.toThrow('Bearer token cannot be sent to localhost');
  });
});
