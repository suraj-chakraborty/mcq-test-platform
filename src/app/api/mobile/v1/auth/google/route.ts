import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';
import { safeJsonParse } from '@/app/lib/validations/common';
import { createMobileTokens } from '@/app/lib/mobileAuth';
import { RateLimiterService, getClientIp } from '@/app/lib/rateLimiter';

const googleAuthSchema = z.object({
  idToken: z.string().min(10, 'Google ID token is required'),
  device: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimiter = new RateLimiterService();
    const isProd = process.env.NODE_ENV === 'production';

    const ipLimit = await rateLimiter.checkLimit('auth', `google-auth:${ip}`, isProd);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { message: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = googleAuthSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Invalid Google token payload', errors: validation.error.format() },
        { status: 400 }
      );
    }

    const { idToken, device } = validation.data;

    // Verify token with Google's tokeninfo endpoint
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );

    if (!googleRes.ok) {
      return NextResponse.json(
        { message: 'Invalid or expired Google authentication token' },
        { status: 401 }
      );
    }

    const googlePayload = await googleRes.json();
    const { email, sub: googleId, name, picture, email_verified } = googlePayload;

    if (!email || !googleId) {
      return NextResponse.json(
        { message: 'Google token does not contain required user claims' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { accounts: true },
    });

    if (!user) {
      user = await (prisma.user as any).create({
        data: {
          email: cleanEmail,
          name: name || 'Google Scholar',
          image: picture || null,
          isVerified: true,
          emailVerified: new Date(),
          accounts: {
            create: {
              type: 'oauth',
              provider: 'google',
              providerAccountId: googleId,
            },
          },
        },
        include: { accounts: true },
      });
    } else {
      // Restore if in deletion grace period
      const userAny = user as any;
      if (userAny.isMarkedForDeletion) {
        await (prisma.user as any).update({
          where: { id: user.id },
          data: { isMarkedForDeletion: false, deletionRequestedAt: null },
        });
      }

      // Check if google account relation exists, create if missing
      const hasGoogleAccount = user.accounts?.some(
        (acc) => acc.provider === 'google' && acc.providerAccountId === googleId
      );
      if (!hasGoogleAccount) {
        await (prisma as any).account.create({
          data: {
            userId: user.id,
            type: 'oauth',
            provider: 'google',
            providerAccountId: googleId,
          },
        });
      }
    }

    if (!user) {
      return NextResponse.json(
        { message: 'Failed to create or retrieve user account' },
        { status: 500 }
      );
    }

    // Issue tokens
    const tokens = await createMobileTokens(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      device || 'Android Mobile App (Google SSO)'
    );

    return NextResponse.json(
      {
        message: 'Google authentication successful',
        ...tokens,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          xp: user.xp,
          level: user.level,
          streak: user.streak,
          targetExam: user.targetExam,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Mobile Google auth error:', error);
    return NextResponse.json(
      { message: 'An error occurred during Google authentication' },
      { status: 500 }
    );
  }
}
