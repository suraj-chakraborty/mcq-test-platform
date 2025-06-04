import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import PDFTest from '@/app/models/PDFTest';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questions } = await request.json();

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'Invalid questions data' },
        { status: 400 }
      );
    }

    await connectDB();

    const test = await PDFTest.findOneAndUpdate(
      {
        _id: params.id,
        userId: session.user.id
      },
      {
        $set: {
          questions,
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      test
    });

  } catch (error) {
    console.error('Error updating questions:', error);
    return NextResponse.json(
      { error: 'Failed to update questions' },
      { status: 500 }
    );
  }
} 