import { NextResponse } from 'next/server';
import connectDB from '@/app/lib/mongodb';
import User from '@/app/models/User';

export async function POST(req: Request) {
  const { email, otp } = await req.json();
  // console.log(email, otp);

  if (!email || !otp) {
    return NextResponse.json({ message: 'Email and OTP required' }, { status: 400 });
  }

  await connectDB();

  const user = await User.findOne({ email });

  if (!user) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  if (user.isVerified) {
    return NextResponse.json({ message: 'User already verified' }, { status: 200 });
  }

  const isExpired = new Date() > new Date(user.otpExpiresAt);
  if (isExpired) {
    return NextResponse.json({ message: 'OTP expired' }, { status: 410 });
  }

  if (user.otp !== otp) {
    return NextResponse.json({ message: 'Invalid OTP' }, { status: 401 });
  }
// console.log(user.otp,otp)
  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiresAt = undefined;
  await user.save();

  return NextResponse.json({ message: 'OTP verified successfully' }, { status: 200 });
}
