import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';
import { safeJsonParse } from '@/app/lib/validations/common';
import { sendEmail } from '@/app/lib/send-mail';
import { RateLimiterService, getClientIp } from '@/app/lib/rateLimiter';

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimiter = new RateLimiterService();
    const isProd = process.env.NODE_ENV === 'production';

    const ipLimit = await rateLimiter.checkLimit('auth', `forgot-password:${ip}`, isProd);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { message: 'Too many password reset requests. Please wait a few minutes.' },
        { status: 429 }
      );
    }

    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = forgotPasswordSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Invalid email address', errors: validation.error.format() },
        { status: 400 }
      );
    }

    const { email } = validation.data;
    const cleanEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    // Uniform response to avoid account enumeration (SEC-017)
    if (!user) {
      return NextResponse.json(
        { message: 'If an account exists with this email, a password reset code has been sent.' },
        { status: 200 }
      );
    }

    const resetOtp = crypto.randomInt(100000, 1000000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await (prisma.user as any).update({
      where: { id: user.id },
      data: {
        otp: resetOtp,
        otpExpiresAt: expiry,
      },
    });

    await sendEmail(
      cleanEmail,
      'Your MCQ Platform Password Reset Code',
      `Your password reset code is ${resetOtp}. This code expires in 10 minutes.`
    );

    return NextResponse.json(
      { message: 'If an account exists with this email, a password reset code has been sent.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { message: 'An error occurred during password reset request' },
      { status: 500 }
    );
  }
}
