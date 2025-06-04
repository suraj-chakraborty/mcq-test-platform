import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import PDFTest from '@/app/models/PDFTest';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const tests = await PDFTest.find({ userId: session.user.id })
      .sort({ createdAt: -1 });

      console.log("PDFtest", tests)

    return NextResponse.json({
      success: true,
      tests
    });

  } catch (error) {
    console.error('Error fetching PDF tests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tests' },
      { status: 500 }
    );
  }
} 