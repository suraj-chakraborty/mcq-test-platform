import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ message: 'Email and OTP required' }, { status: 400 });
    }

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
