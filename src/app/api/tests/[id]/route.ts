import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import TestResult from '@/app/models/TestResult';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }>}
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const test = await TestResult.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!test) {
      return NextResponse.json(
        { message: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Test fetched successfully',
      test,
    });
  } catch (error) {
    console.error('Test fetch error:', error);
    return NextResponse.json(
      { message: 'An error occurred while fetching the test' },
      { status: 500 }
    );
  }
} 