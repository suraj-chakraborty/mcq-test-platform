import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  RateLimiterService,
  getRouteCategory,
  resolveRateLimitIdentifier,
} from '@/app/lib/rateLimiter';

const rateLimiterService = new RateLimiterService();

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api')) {
    const isProduction = process.env.NODE_ENV === 'production';
    const category = getRouteCategory(pathname);
    const { identifier, isAuthenticated, userId } = await resolveRateLimitIdentifier(request);

    const result = await rateLimiterService.checkLimit(category, identifier, isProduction);

    if (!result.allowed) {
      if (result.errorReason === 'CONFIG_MISSING_IN_PROD') {
        return new NextResponse(
          JSON.stringify({
            error: 'Security service unavailable: Rate limiting configuration is missing in production. Requests are blocked by fail-closed policy.',
            code: 'RATE_LIMIT_CONFIG_MISSING',
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
            },
          }
        );
      }

      return new NextResponse(
        JSON.stringify({
          error: `Too Many Requests. Rate limit exceeded for ${category} bucket.`,
          code: 'RATE_LIMIT_EXCEEDED',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.reset.toString(),
            'Retry-After': Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)).toString(),
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.reset.toString());
    response.headers.set('X-RateLimit-Key-Type', isAuthenticated && userId ? 'user' : 'ip');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
