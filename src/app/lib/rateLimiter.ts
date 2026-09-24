import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export type RouteCategory = 'auth' | 'heavy' | 'duel' | 'general';

/**
 * Extracts client IP giving strict precedence to Netlify's trusted client headers
 */
export function getClientIp(request: Request): string {
  const netlifyClientIp =
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('client-ip');
  if (netlifyClientIp && netlifyClientIp.trim()) {
    return netlifyClientIp.trim();
  }

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return '127.0.0.1';
}

/**
 * Maps a given API route pathname to its corresponding rate limiting bucket
 */
export function getRouteCategory(pathname: string): RouteCategory {
  if (pathname.startsWith('/api/auth') || pathname.toLowerCase().startsWith('/api/verify-otp')) {
    return 'auth';
  }
  if (
    pathname.startsWith('/api/upload') ||
    pathname.startsWith('/api/pdfs/upload') ||
    pathname.startsWith('/api/pdf-tests/create') ||
    pathname.startsWith('/api/generate') ||
    pathname === '/api/duels/create'
  ) {
    return 'heavy';
  }
  if (pathname.startsWith('/api/duels')) {
    return 'duel';
  }
  return 'general';
}

/**
 * Extracts rate limit identifier:
 * - Auth bucket: Keyed on `auth:<ip>:<submittedAccountIdentifier>`
 * - Authenticated requests: Keyed on `user:<userId>`
 * - Anonymous requests: Keyed on `ip:<clientIp>`
 */
export async function resolveRateLimitIdentifier(
  request: NextRequest | Request,
  secret?: string
): Promise<{ identifier: string; isAuthenticated: boolean; userId?: string }> {
  const ip = getClientIp(request);
  const nextUrl = (request as any).nextUrl;
  const urlObj = nextUrl ? nextUrl : new URL(request.url, 'http://localhost:3000');
  const pathname = urlObj.pathname;
  const category = getRouteCategory(pathname);

  // 1. Auth Bucket: Keyed by IP + submitted account identifier
  if (category === 'auth') {
    let accountIdentifier = '';
    const searchParams = urlObj.searchParams;
    accountIdentifier =
      searchParams.get('email') ||
      searchParams.get('phone') ||
      searchParams.get('username') ||
      '';

    if (!accountIdentifier) {
      accountIdentifier =
        request.headers.get('x-account-identifier') ||
        request.headers.get('x-auth-identifier') ||
        '';
    }

    const cleanAccount = accountIdentifier.trim().toLowerCase() || 'anonymous';
    return {
      identifier: `auth:${ip}:${cleanAccount}`,
      isAuthenticated: false,
    };
  }

  // 2. Non-auth routes: Key by authenticated user ID if session JWT is present
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

  // 3. Anonymous fallback: Key by IP
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
  errorReason?: 'CONFIG_MISSING_IN_PROD' | 'RATE_EXCEEDED' | 'UPSTASH_UNREACHABLE_FAIL_CLOSED';
  isDegraded?: boolean;
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
        // Strict brute-force protection
        auth: new Ratelimit({
          redis: this.redis,
          limiter: Ratelimit.slidingWindow(10, '60 s'),
          prefix: 'rl:auth',
          analytics: true,
        }),
        // Heavy resource/LLM endpoints
        heavy: new Ratelimit({
          redis: this.redis,
          limiter: Ratelimit.slidingWindow(10, '60 s'),
          prefix: 'rl:heavy',
          analytics: true,
        }),
        // Duel routes: 120 req/60s (well above ~25 req/min measured polling rate for 2+ players on same IP)
        duel: new Ratelimit({
          redis: this.redis,
          limiter: Ratelimit.slidingWindow(120, '60 s'),
          prefix: 'rl:duel',
          analytics: true,
        }),
        // Standard API endpoints
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

    // Enforce 1500ms timeout on Upstash connection to prevent hanging requests
    try {
      const limitPromise = limiter.limit(identifier);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('UPSTASH_TIMEOUT')), 1500)
      );

      const { success, limit, remaining, reset } = await Promise.race([
        limitPromise,
        timeoutPromise,
      ]);

      return {
        allowed: success,
        limit,
        remaining,
        reset,
        errorReason: success ? undefined : 'RATE_EXCEEDED',
      };
    } catch (error) {
      console.error(`[RATE_LIMIT_UNREACHABLE] Upstash error on category ${category}:`, error);

      // Define runtime behavior when Upstash is unreachable:
      // FAIL CLOSED for high-risk categories (auth / heavy token-burning routes)
      if (category === 'auth' || category === 'heavy') {
        return {
          allowed: false,
          limit: 0,
          remaining: 0,
          reset: Date.now() + 60000,
          errorReason: 'UPSTASH_UNREACHABLE_FAIL_CLOSED',
        };
      }

      // FAIL OPEN WITH ALERT for low-risk interactive categories (general / duel polling)
      console.warn(
        `[RATE_LIMIT_ALERT] Upstash unreachable: Failing open for ${category} category to maintain user experience.`
      );
      return {
        allowed: true,
        limit: 9999,
        remaining: 9999,
        reset: 0,
        isDegraded: true,
      };
    }
  }
}
