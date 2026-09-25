import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';
import { safeJsonParse } from '@/app/lib/validations/common';
import { sendEmail } from '@/app/lib/send-mail';
import { RateLimiterService, getClientIp } from '@/app/lib/rateLimiter';

const resendOtpSchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimiter = new RateLimiterService();
    const isProd = process.env.NODE_ENV === 'production';

    const ipLimit = await rateLimiter.checkLimit('auth', `resend-otp:${ip}`, isProd);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { message: 'Too many OTP requests. Please wait before requesting again.' },
        { status: 429 }
      );
    }

    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = resendOtpSchema.safeParse(parseResult.data);
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

    // Don't disclose whether email exists or not (SEC-017)
    if (!user) {
      return NextResponse.json(
        { message: 'If an unverified account exists, a new OTP code has been sent.' },
        { status: 200 }
      );
    }

    if (user.isVerified) {
      return NextResponse.json(
        { message: 'This email is already verified. Please sign in.' },
        { status: 400 }
      );
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await (prisma.user as any).update({
      where: { id: user.id },
      data: {
        otp: otpCode,
        otpExpiresAt: otpExpiry,
      },
    });

    await sendEmail(
      cleanEmail,
      'Your New Verification Code',
      `Your new verification OTP code is ${otpCode}. It expires in 5 minutes.`
    );

    return NextResponse.json(
      { message: 'If an unverified account exists, a new OTP code has been sent.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Mobile resend OTP error:', error);
    return NextResponse.json(
      { message: 'An error occurred while resending OTP' },
      { status: 500 }
    );
  }
}
