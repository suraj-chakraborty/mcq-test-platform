import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/app/lib/prisma';
import { registerSchema } from '@/lib/validations/auth';
import { sendEmail } from '@/app/lib/send-mail';

export async function POST(req: Request) {
  const OTPgenerator = Math.floor(100000 + Math.random() * 900000);

  try {
    const body = await req.json();
    
    // Zod validation
    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.format() },
        { status: 400 }
      );
    }

    const { name, email, password } = result.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ 
        where: { email } 
    });
    
    if (existingUser) {
      return NextResponse.json(
        { message: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // Create user in Prisma
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        otp: OTPgenerator.toString(),
        otpExpiresAt: otpExpiry,
        isVerified: false,
      }
    });

    await sendEmail(email, 'Your OTP Code', `Your OTP is ${OTPgenerator}`);

    return NextResponse.json(
      { 
        message: 'User created. OTP sent to email.',
        user: { id: user.id, name: user.name, email: user.email } 
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