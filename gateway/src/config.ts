import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('127.0.0.1'),
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  APPROVAL_HMAC_SECRET: z.string().min(32, 'APPROVAL_HMAC_SECRET must be at least 32 characters'),
  APPROVAL_KEY_ID: z.string().min(1, 'APPROVAL_KEY_ID is required'),
  APPROVAL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  API_KEY_AGENT: z.string().min(1, 'API_KEY_AGENT is required'),
  API_KEY_ADAPTER_GOAT: z.string().min(1, 'API_KEY_ADAPTER_GOAT is required'),
  API_KEY_ADAPTER_QATOM: z.string().min(1, 'API_KEY_ADAPTER_QATOM is required'),
  API_KEY_DASHBOARD: z.string().min(1, 'API_KEY_DASHBOARD is required'),
  API_KEY_ADMIN: z.string().min(1, 'API_KEY_ADMIN is required'),
});

export type Config = z.infer<typeof envSchema>;

export function guardedTestDatabaseUrl(env: Record<string, string | undefined>): string {
  if (env.NODE_ENV !== 'test') {
    throw new Error('Database tests require NODE_ENV=test');
  }
  const value = env.TEST_DATABASE_URL;
  if (!value) throw new Error('Database tests require TEST_DATABASE_URL');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL');
  }
  let databasePath: string;
  try { databasePath = decodeURIComponent(parsed.pathname); }
  catch { throw new Error('TEST_DATABASE_URL has an invalid database name'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !/^\/[A-Za-z0-9_-]+_test$/.test(databasePath) || parsed.search || parsed.hash) {
    throw new Error('TEST_DATABASE_URL database name must end in _test');
  }
  return value;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const keys = ['API_KEY_AGENT', 'API_KEY_ADAPTER_GOAT', 'API_KEY_ADAPTER_QATOM', 'API_KEY_DASHBOARD', 'API_KEY_ADMIN'];
  const present = keys.map((key) => env[key]).filter((value): value is string => Boolean(value));
  if (new Set(present).size !== present.length) throw new Error('API key values must be unique');
  const runtimeEnv = env.NODE_ENV === 'test' || env.VITEST === 'true' || env.TEST_SUITE === 'integration'
    ? { ...env, DATABASE_URL: guardedTestDatabaseUrl(env) }
    : env;
  const parsed = envSchema.safeParse(runtimeEnv);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues.map(
      (iss) => `${iss.path.join('.')}: ${iss.message}`
    ).join(', ');
    throw new Error(`Invalid configuration: ${errorMessages}`);
  }
  return parsed.data;
}

export const config = loadConfig();

export function parseCorsOrigins(value: string): string[] {
  return value.split(',').map((origin) => origin.trim()).filter(Boolean);
}
