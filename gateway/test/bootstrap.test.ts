import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';
import { buildServer } from '../src/server.js';

describe('Server & Config Bootstrap', () => {
  it('validates environment config strictly', () => {
    const validEnv = {
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/test',
      APPROVAL_HMAC_SECRET: 'super-secret-key-that-is-at-least-32-chars-long',
      APPROVAL_KEY_ID: 'k1',
      APPROVAL_TTL_SECONDS: '300',
      API_KEY_AGENT: 'agent-1',
      API_KEY_ADAPTER_GOAT: 'goat-1',
      API_KEY_ADAPTER_QATOM: 'qatom-1',
      API_KEY_DASHBOARD: 'dash-1',
      API_KEY_ADMIN: 'admin-1',
    };

    const cfg = loadConfig(validEnv);
    expect(cfg.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(cfg.APPROVAL_TTL_SECONDS).toBe(300);
  });

  it('fails config validation when secret is too short', () => {
    const invalidEnv = {
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/test',
      APPROVAL_HMAC_SECRET: 'too-short',
      APPROVAL_KEY_ID: 'k1',
      API_KEY_AGENT: 'a',
      API_KEY_ADAPTER_GOAT: 'g',
      API_KEY_ADAPTER_QATOM: 'q',
      API_KEY_DASHBOARD: 'd',
      API_KEY_ADMIN: 'adm',
    };

    expect(() => loadConfig(invalidEnv)).toThrow(/APPROVAL_HMAC_SECRET must be at least 32 characters/);
  });

  it('responds with 200 on /health', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    await app.close();
  });
});
