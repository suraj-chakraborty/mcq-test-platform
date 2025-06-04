import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import TestResult from '@/app/models/TestResult';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  
  try {
    console.log("params", params )
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const attemptId = params.id;
    
    // Check if attemptId is undefined or 'undefined'
    if (!attemptId || attemptId === 'undefined') {
      // If no attemptId is provided, return all attempts for the user
      const attempts = await TestResult.find({
        userId: session.user.id,
      }).sort({ createdAt: -1 });
      
      return NextResponse.json(attempts);
    }

    // If attemptId is provided, find specific attempt
    const attempt = await TestResult.findOne({
      _id: attemptId,
      userId: session.user.id,
    });
    console.log("server attempt", attempt)

    if (!attempt) {
      return NextResponse.json(
        { error: 'Test attempt not found' },
        { status: 404 }
      );
    }
    console.log("server attempt", attempt)
    return NextResponse.json(attempt);
  } catch (error) {
    console.error('Error fetching test attempt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 