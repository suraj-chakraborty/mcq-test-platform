import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  NEXTAUTH_SECRET: z.string().min(16, 'NEXTAUTH_SECRET must be at least 16 characters'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL').optional(),
  GOOGLE_AI_API_KEY: z.string().min(1, 'GOOGLE_AI_API_KEY is required').optional(),
  GOOGLE_AI_API_KEYS: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required').optional(),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required').optional(),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required').optional(),
  UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL').optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required').optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment configuration at startup.
 * In production, it fails fast and throws an error if any critical variables are missing.
 */
export function validateEnv(): Env {
  const isProduction = process.env.NODE_ENV === 'production';
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errorMessages = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    const failureSummary = `[FATAL] Environment validation failed:\n${errorMessages}`;

    if (isProduction) {
      console.error(failureSummary);
      throw new Error(`CRITICAL CONFIGURATION ERROR: Missing required environment variables in production.\n${errorMessages}`);
    } else {
      console.warn(`[WARN] Non-production environment warnings:\n${errorMessages}`);
    }
  }

  // Production-specific strict checks
  if (isProduction) {
    if (!process.env.GOOGLE_AI_API_KEY && !process.env.GOOGLE_AI_API_KEYS) {
      throw new Error('CRITICAL CONFIGURATION ERROR: Either GOOGLE_AI_API_KEY or GOOGLE_AI_API_KEYS must be set in production.');
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('CRITICAL CONFIGURATION ERROR: Complete Cloudinary credentials (NAME, KEY, SECRET) are mandatory in production.');
    }
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('CRITICAL CONFIGURATION ERROR: Upstash Redis (URL and TOKEN) is mandatory in production for rate limiting and real-time state.');
    }
  }

  return (parsed.data || process.env) as Env;
}

// Automatically validate on module import if in production
if (process.env.NODE_ENV === 'production') {
  validateEnv();
}
