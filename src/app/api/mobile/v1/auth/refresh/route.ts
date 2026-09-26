import { NextResponse } from 'next/server';
import { z } from 'zod';
import { safeJsonParse } from '@/app/lib/validations/common';
import { rotateMobileRefreshToken } from '@/app/lib/mobileAuth';
import { RateLimiterService, getClientIp } from '@/app/lib/rateLimiter';

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
  device: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimiter = new RateLimiterService();
    const isProd = process.env.NODE_ENV === 'production';

    const ipLimit = await rateLimiter.checkLimit('auth', `refresh:${ip}`, isProd);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { message: 'Too many refresh requests. Try again shortly.' },
        { status: 429 }
      );
    }

    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = refreshSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Invalid refresh request', errors: validation.error.format() },
        { status: 400 }
      );
    }

    const { refreshToken, device } = validation.data;

    try {
      const result = await rotateMobileRefreshToken(refreshToken, device);

      return NextResponse.json(
        {
          message: 'Token refreshed successfully',
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          tokenType: result.tokenType,
          expiresIn: result.expiresIn,
          user: result.user,
        },
        { status: 200 }
      );
    } catch (err: any) {
      return NextResponse.json(
        {
          message: err.message || 'Invalid or expired session. Please sign in again.',
          code: 'REFRESH_TOKEN_INVALID',
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { message: 'An error occurred during token refresh' },
      { status: 500 }
    );
  }
}
