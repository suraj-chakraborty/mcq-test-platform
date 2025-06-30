import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/app/lib/mongodb';
import User from '@/app/models/User';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    // console.log('Login request received:', { email, password });

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    await connectDB();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    // get user
  //   const user = await prisma.user.findUnique({
  //     where: {
  //       email: email,
  //     }
  // });
  // console.log("hassed password",hashedPassword)
    const user = await User.findOne({
      email,
    });
    // console.log("userpassword", user.password)
    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 400 }
      );
    }else if (user.password !== hashedPassword) {
        return NextResponse.json(
            { message: 'wrong credentials' },
            { status: 400 }
          );
    }

    return NextResponse.json(
      { message: 'User logged in successfully', user: { id: user.id, name: user.name, email: user.email } },
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