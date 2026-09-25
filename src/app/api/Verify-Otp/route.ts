import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';
import { safeJsonParse } from '@/app/lib/validations/common';

const verifyOtpSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
}).strict();

export async function POST(req: Request) {
  try {
    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = verifyOtpSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Invalid email or OTP format', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { email, otp } = validation.data;


    const user = await prisma.user.findUnique({
      where: { email },
    }) as any; // Explicit cast to resolve transient Prisma type mismatches

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    if (user.isVerified) {
      return NextResponse.json({ message: 'User already verified' }, { status: 200 });
    }

    if (!user.otpExpiresAt || new Date() > new Date(user.otpExpiresAt)) {
      return NextResponse.json({ message: 'OTP expired' }, { status: 410 });
    }

    if (user.otp !== otp) {
      return NextResponse.json({ message: 'Invalid OTP' }, { status: 401 });
    }

    await (prisma.user as any).update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otp: null,
        otpExpiresAt: null,
      },
    });

    return NextResponse.json({ message: 'OTP verified successfully' }, { status: 200 });
  } catch (error) {
    console.error('OTP verification error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
