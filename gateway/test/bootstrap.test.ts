import { describe, it, expect } from 'vitest';
import { guardedTestDatabaseUrl, loadConfig } from '../src/config.js';
import { buildServer } from '../src/server.js';

describe('Server & Config Bootstrap', () => {
  it('validates environment config strictly', () => {
    const validEnv = {
      NODE_ENV: 'test',
      CORS_ORIGINS: 'http://localhost:3000',
      TEST_DATABASE_URL: 'postgresql://postgres:password@localhost:5432/payment_guard_test',
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
    expect(cfg.DATABASE_URL).toBe(validEnv.TEST_DATABASE_URL);
    expect(cfg.APPROVAL_TTL_SECONDS).toBe(300);
  });

  it('requires an explicitly named test database without revealing URL contents', () => {
    expect(() => guardedTestDatabaseUrl({ NODE_ENV: 'test' })).toThrow('TEST_DATABASE_URL');
    expect(() => guardedTestDatabaseUrl({ NODE_ENV: 'test', TEST_DATABASE_URL: 'postgresql://secret@host/db' })).toThrow('_test');
    expect(() => guardedTestDatabaseUrl({ NODE_ENV: 'development', TEST_DATABASE_URL: 'postgresql://secret@host/db_test' })).toThrow('NODE_ENV=test');
    expect(guardedTestDatabaseUrl({ NODE_ENV: 'test', TEST_DATABASE_URL: 'postgresql://fake@127.0.0.1/db_test' })).toContain('/db_test');
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

  it('rejects duplicate API keys without disclosing their values', () => {
    expect(() => loadConfig({ ...process.env, API_KEY_ADMIN: process.env.API_KEY_AGENT })).toThrow('API key values must be unique');
  });

  it('allows only configured browser origins', async () => {
    const app = await buildServer();
    try {
      const allowed = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:3000' } });
      expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      const denied = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://untrusted.example' } });
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});
