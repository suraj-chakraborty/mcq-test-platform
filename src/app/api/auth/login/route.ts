import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import { prisma } from '@/app/lib/prisma';
import { loginSchema } from '@/app/lib/validations/auth';
import { safeJsonParse } from '@/app/lib/validations/common';
import { RateLimiterService, getClientIp } from '@/app/lib/rateLimiter';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimiter = new RateLimiterService();
    const isProd = process.env.NODE_ENV === 'production';

    // 1. IP rate limit check on auth bucket
    const ipLimitResult = await rateLimiter.checkLimit('auth', `auth:${ip}`, isProd);
    if (!ipLimitResult.allowed) {
      const retryAfter = Math.ceil((ipLimitResult.reset - Date.now()) / 1000);
      return NextResponse.json(
        { message: `Too many login attempts. Try again in ${Math.max(1, retryAfter)}s.`, error: 'Too many login attempts' },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfter)) } }
      );
    }

    // 2. Safe JSON Parse & Schema Validation
    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validationResult = loginSchema.safeParse(parseResult.data);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: 'Invalid email or password format', error: 'Validation failed', errors: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;
    const cleanEmail = email.trim().toLowerCase();

    // 3. Per-account brute-force check
    const accountLimit = await rateLimiter.checkAccountLoginLimit(cleanEmail, isProd);
    if (!accountLimit.allowed) {
      const retryAfter = Math.ceil((accountLimit.reset - Date.now()) / 1000);
      return NextResponse.json(
        { message: `Account temporarily locked due to excessive failed attempts. Try again in ${Math.max(1, retryAfter)}s.`, error: 'Account temporarily locked' },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfter)) } }
      );
    }

    // 4. Query user
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    // Uniform response for non-existent user or null password (OAuth accounts) to prevent enumeration (SEC-017)
    if (!user || !user.password) {
      return NextResponse.json(
        { message: 'Invalid email or password', error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 5. Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'Invalid email or password', error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 6. Check verification status
    if (!user.isVerified) {
      return NextResponse.json(
        { message: 'Please verify your email with OTP before logging in', error: 'Email not verified' },
        { status: 403 }
      );
    }

    // 7. Account Deletion Lifecycle (30-day grace period restoration)
    const userAny = user as any;
    if (userAny.isMarkedForDeletion && userAny.deletionRequestedAt) {
      const msSinceDeletion = Date.now() - new Date(userAny.deletionRequestedAt).getTime();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

      if (msSinceDeletion > thirtyDaysInMs) {
        try {
          await prisma.user.delete({ where: { id: user.id } });
        } catch (err) {
          console.error('Error deleting expired account:', err);
        }
        return NextResponse.json(
          { message: 'This account has been permanently deleted after the 30-day grace period.', error: 'Account deleted' },
          { status: 403 }
        );
      } else {
        try {
          await (prisma.user as any).update({
            where: { id: user.id },
            data: { isMarkedForDeletion: false, deletionRequestedAt: null },
          });
        } catch (err) {
          console.error('Error restoring account on login:', err);
        }
      }
    }

    // 8. Generate NextAuth-compatible signed JWT token for mobile / API consumers (SEC-011)
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'dev_secret_jwt_key_32_characters_long_min!';
    const maxAge = 7 * 24 * 60 * 60; // 7 days (SEC-021)
    const accessToken = await encode({
      token: {
        id: user.id,
        sub: user.id,
        name: user.name,
        email: user.email,
        picture: user.image,
      },
      secret,
      maxAge,
    });

    return NextResponse.json(
      {
        message: 'User logged in successfully',
        accessToken,
        tokenType: 'Bearer',
        expiresIn: maxAge,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'An error occurred during login', error: 'Internal server error' },
      { status: 500 }
    );
  }
}
