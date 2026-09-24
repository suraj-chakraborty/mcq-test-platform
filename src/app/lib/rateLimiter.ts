import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export type RouteCategory = 'auth' | 'heavy' | 'general';

/**
 * Maps a given API route pathname to its corresponding rate limiting bucket
 */
export function getRouteCategory(pathname: string): RouteCategory {
  if (pathname.startsWith('/api/auth')) {
    return 'auth';
  }
  if (
    pathname.startsWith('/api/upload') ||
    pathname.startsWith('/api/pdfs/upload') ||
    pathname.startsWith('/api/pdf-tests/create') ||
    pathname.startsWith('/api/generate') ||
    pathname.startsWith('/api/duels/create')
  ) {
    return 'heavy';
  }
  return 'general';
}

/**
 * Extracts rate limit identifier:
 * - When user is authenticated (NextAuth JWT token present): returns `user:<userId>`
 * - When user is anonymous: returns `ip:<clientIp>`
 */
export async function resolveRateLimitIdentifier(
  request: NextRequest,
  secret?: string
): Promise<{ identifier: string; isAuthenticated: boolean; userId?: string }> {
  try {
    const token = await getToken({
      req: request,
      secret: secret || process.env.NEXTAUTH_SECRET,
    });

    const userId = (token?.id as string) || (token?.sub as string) || (token?.email as string);
    if (userId) {
      return {
        identifier: `user:${userId}`,
        isAuthenticated: true,
        userId,
      };
    }
  } catch (err) {
    // If token parsing fails, fall back to IP identifier
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  return {
    identifier: `ip:${ip}`,
    isAuthenticated: false,
  };
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  errorReason?: 'CONFIG_MISSING_IN_PROD' | 'RATE_EXCEEDED';
}

export class RateLimiterService {
  private redis: Redis | null = null;
  private limiters: Record<RouteCategory, Ratelimit> | null = null;

  constructor(url?: string, token?: string) {
    const redisUrl = url || process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = token || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
      this.redis = new Redis({
        url: redisUrl,
        token: redisToken,
      });

      this.limiters = {
        auth: new Ratelimit({
          redis: this.redis,
          limiter: Ratelimit.slidingWindow(10, '60 s'),
          prefix: 'rl:auth',
          analytics: true,
        }),
        heavy: new Ratelimit({
          redis: this.redis,
          limiter: Ratelimit.slidingWindow(10, '60 s'),
          prefix: 'rl:heavy',
          analytics: true,
        }),
        general: new Ratelimit({
          redis: this.redis,
          limiter: Ratelimit.slidingWindow(60, '60 s'),
          prefix: 'rl:gen',
          analytics: true,
        }),
      };
    }
  }

  isConfigured(): boolean {
    return this.limiters !== null;
  }

  async checkLimit(
    category: RouteCategory,
    identifier: string,
    isProduction: boolean
  ): Promise<RateLimitCheckResult> {
    if (!this.limiters) {
      if (isProduction) {
        // Fail CLOSED in production if Upstash config is missing
        return {
          allowed: false,
          limit: 0,
          remaining: 0,
          reset: Date.now() + 60000,
          errorReason: 'CONFIG_MISSING_IN_PROD',
        };
      }
      // Non-production fallback (allow during local dev / test)
      return {
        allowed: true,
        limit: 9999,
        remaining: 9999,
        reset: 0,
      };
    }

    const limiter = this.limiters[category];
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    return {
      allowed: success,
      limit,
      remaining,
      reset,
      errorReason: success ? undefined : 'RATE_EXCEEDED',
    };
  }
}
