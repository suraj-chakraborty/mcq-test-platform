import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/app/lib/prisma';
import { registerSchema } from '@/app/lib/validations/auth';
import { safeJsonParse } from '@/app/lib/validations/common';
import { sendEmail } from '@/app/lib/send-mail';

export async function POST(req: Request) {
  try {
    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const result = registerSchema.safeParse(parseResult.data);
    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.format() },
        { status: 400 }
      );
    }

    const { name, email, password, phone, targetExam } = result.data;
    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    if (phone && phone.trim() !== '') {
      const existingPhoneUser = await (prisma.user as any).findFirst({
        where: { phone: phone.trim() },
      });
      if (existingPhoneUser) {
        return NextResponse.json(
          { message: 'Phone number is already associated with another account' },
          { status: 400 }
        );
      }
    }

    // Generate secure 6-digit OTP
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const hashedPassword = await bcrypt.hash(password, 12);
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    const user = await (prisma.user as any).create({
      data: {
        name,
        email: cleanEmail,
        password: hashedPassword,
        phone: phone && phone.trim() !== '' ? phone.trim() : null,
        targetExam: targetExam && targetExam.trim() !== '' ? targetExam.trim() : null,
        otp: otpCode,
        otpExpiresAt: otpExpiry,
        isVerified: false,
      },
    });

    await sendEmail(
      cleanEmail,
      'Your MCQ Test Platform Verification Code',
      `Your verification OTP code is ${otpCode}. It expires in 5 minutes.`
    );

    return NextResponse.json(
      {
        message: 'Registration successful. OTP sent to your email.',
        email: user.email,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Mobile registration error:', error);
    return NextResponse.json(
      { message: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}
