import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import Test from '@/app/models/Test';

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const test = await Test.findByIdAndDelete(params.id);

    if (!test) {
      return NextResponse.json(
        { message: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'PDF deleted successfully',
      test,
    });
  } catch (error) {
    console.error('PDF delete error:', error);
    return NextResponse.json(
      { message: 'An error occurred while deleting the PDF' },
      { status: 500 }
    );
  }
} 