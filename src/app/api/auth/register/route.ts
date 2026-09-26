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

    // Zod validation
    const result = registerSchema.safeParse(parseResult.data);
    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.format() },
        { status: 400 }
      );
    }

    const { name, email, password, phone, targetExam } = result.data;

    // Check if user already exists by email
    const existingUser = await prisma.user.findUnique({ 
        where: { email } 
    });
    
    if (existingUser) {
      return NextResponse.json(
        { message: 'User already exists' },
        { status: 400 }
      );
    }

    // Check if phone number is already in use by another user
    if (phone && phone.trim() !== '') {
      const existingPhoneUser = await (prisma.user as any).findFirst({
        where: { phone: phone.trim() }
      });
      if (existingPhoneUser) {
        return NextResponse.json(
          { message: 'Phone number is already associated with another account' },
          { status: 400 }
        );
      }
    }

    // Generate cryptographically secure OTP (SEC-006)
    const otpCode = crypto.randomInt(100000, 1000000).toString();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // Create user in Prisma
    const user = await (prisma.user as any).create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone: phone && phone.trim() !== '' ? phone.trim() : null,
        targetExam: targetExam && targetExam.trim() !== '' ? targetExam.trim() : null,
        otp: otpCode,
        otpExpiresAt: otpExpiry,
        isVerified: false,
      }
    });

    await sendEmail(email, 'Your OTP Code', `Your OTP is ${otpCode}`);

    return NextResponse.json(
      { 
        message: 'User created. OTP sent to email.',
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, targetExam: user.targetExam } 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { message: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}
