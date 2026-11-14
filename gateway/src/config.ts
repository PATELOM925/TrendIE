import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
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

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues.map(
      (iss) => `${iss.path.join('.')}: ${iss.message}`
    ).join(', ');
    throw new Error(`Invalid configuration: ${errorMessages}`);
  }
  return parsed.data;
}

export const config = loadConfig();
