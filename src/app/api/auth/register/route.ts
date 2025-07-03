import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/app/lib/mongodb';
import User from '@/app/models/User';
import { sendEmail } from '@/app/lib/send-mail';

export async function POST(req: Request) {
  //todo: implement otp verification
  const OTPgenerator = Math.floor(100000 + Math.random() * 900000);

  try {
    const { name, email, password } = await req.json();
    // console.log(name,email,password)

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { message: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash password
    // console.log(password)
    const hashedPassword = await bcrypt.hash(password, 12);
    // console.log("registerpassword", hashedPassword)
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      otp: OTPgenerator.toString(),
      otpExpiresAt: otpExpiry,
      isVerified: false,
    });

    await sendEmail(email, 'Your OTP Code', `Your OTP is ${OTPgenerator}`);

    return NextResponse.json(
      { message: 'User created. OTP sent to email.',
         user: { id: user._id, name: user.name, email: user.email } },
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