import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';
import { safeJsonParse } from '@/app/lib/validations/common';
import { checkOtpRateLimit, recordFailedOtpAttempt, clearOtpAttempts } from '@/app/lib/rateLimiter';

const resetPasswordSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(req: Request) {
  try {
    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = resetPasswordSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: validation.error.format() },
        { status: 400 }
      );
    }

    const { email, otp, newPassword } = validation.data;
    const cleanEmail = email.trim().toLowerCase();

    // Brute-force check on reset code
    const rateCheck = await checkOtpRateLimit(`reset:${cleanEmail}`);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { message: 'Too many failed reset attempts. Account locked for 15 minutes.' },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user || !user.otp || !user.otpExpiresAt) {
      return NextResponse.json(
        { message: 'Invalid or expired password reset code' },
        { status: 400 }
      );
    }

    if (new Date() > new Date(user.otpExpiresAt)) {
      return NextResponse.json(
        { message: 'Password reset code has expired' },
        { status: 410 }
      );
    }

    if (user.otp !== otp) {
      const failStatus = await recordFailedOtpAttempt(`reset:${cleanEmail}`);
      if (!failStatus.allowed) {
        return NextResponse.json(
          { message: 'Too many failed reset attempts. Account locked for 15 minutes.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          message: 'Invalid password reset code',
          remainingAttempts: Math.max(0, failStatus.remainingAttempts),
        },
        { status: 400 }
      );
    }

    // Success: clear rate limiter, hash new password, revoke existing tokens
    await clearOtpAttempts(`reset:${cleanEmail}`);

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await (prisma.user as any).update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        otp: null,
        otpExpiresAt: null,
        isVerified: true, // Resetting via verified email confirms ownership
      },
    });

    // Revoke all previous mobile refresh tokens for security
    await (prisma as any).mobileRefreshToken.updateMany({
      where: { userId: user.id },
      data: { revoked: true },
    });

    return NextResponse.json(
      { message: 'Password reset successfully. You can now sign in with your new password.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { message: 'An error occurred during password reset' },
      { status: 500 }
    );
  }
}
