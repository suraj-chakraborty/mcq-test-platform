import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';
import { safeJsonParse } from '@/app/lib/validations/common';
import { checkOtpRateLimit, recordFailedOtpAttempt, clearOtpAttempts } from '@/app/lib/rateLimiter';
import { createMobileTokens } from '@/app/lib/mobileAuth';

const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  device: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = verifyOtpSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Invalid email or OTP format', errors: validation.error.format() },
        { status: 400 }
      );
    }

    const { email, otp, device } = validation.data;
    const cleanEmail = email.trim().toLowerCase();

    // Rate limiting check
    const rateCheck = await checkOtpRateLimit(cleanEmail);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { message: 'Too many failed OTP verification attempts. Account locked for 15 minutes.' },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    if (!user.otp || !user.otpExpiresAt) {
      return NextResponse.json(
        { message: 'No pending OTP verification found' },
        { status: 400 }
      );
    }

    if (new Date() > new Date(user.otpExpiresAt)) {
      return NextResponse.json({ message: 'OTP has expired' }, { status: 410 });
    }

    if (user.otp !== otp) {
      const failStatus = await recordFailedOtpAttempt(cleanEmail);
      if (!failStatus.allowed) {
        return NextResponse.json(
          { message: 'Too many failed OTP verification attempts. Account locked for 15 minutes.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          message: 'Invalid OTP',
          remainingAttempts: Math.max(0, failStatus.remainingAttempts),
        },
        { status: 400 }
      );
    }

    // Success: clear rate limiter and clear OTP
    await clearOtpAttempts(cleanEmail);

    const updatedUser = await (prisma.user as any).update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerified: new Date(),
        otp: null,
        otpExpiresAt: null,
      },
    });

    // Issue tokens
    const tokens = await createMobileTokens(
      {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        image: updatedUser.image,
      },
      device
    );

    return NextResponse.json(
      {
        message: 'OTP verified successfully',
        ...tokens,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          image: updatedUser.image,
          xp: updatedUser.xp,
          level: updatedUser.level,
          streak: updatedUser.streak,
          targetExam: updatedUser.targetExam,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Mobile OTP verification error:', error);
    return NextResponse.json(
      { message: 'An error occurred during OTP verification' },
      { status: 500 }
    );
  }
}
