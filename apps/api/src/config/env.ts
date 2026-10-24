import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().min(1).default('v1'),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  DIRECT_URL: z.string().url().startsWith('postgresql://').optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_VERSION: z.string().min(1).default('0.1.0'),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default(''),
  EMAIL_FROM: z.string().email().default('no-reply@salonos.local'),
});

export type AppConfig = z.infer<typeof schema>;

export function validateEnvironment(config: Record<string, unknown>): AppConfig {
  const result = schema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }
  return result.data;
}
