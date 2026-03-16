import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/app/lib/prisma';
import { rateLimit } from '@/app/lib/rate_limit';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';

  const { allowed, retryAfter } = rateLimit(ip);
  if (!allowed) {
    return new Response(
      JSON.stringify({ message: `Too many attempts. Try again in ${retryAfter}s.` }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { message: 'User not found or invalid credentials' },
        { status: 400 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: 'User logged in successfully', user: { id: user.id, name: user.name, email: user.email } },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'An error occurred during login' },
      { status: 500 }
    );
  }
}