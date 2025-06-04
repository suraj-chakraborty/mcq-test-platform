import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import Pdf from '@/app/models/Pdf';

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

    const pdf = await Pdf.findOneAndDelete({
      _id: params.id,
      userId: session.user.id,
    });

    if (!pdf) {
      return NextResponse.json(
        { message: 'PDF not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'PDF deleted successfully',
      pdf,
    });
  } catch (error) {
    console.error('PDF delete error:', error);
    return NextResponse.json(
      { message: 'An error occurred while deleting the PDF' },
      { status: 500 }
    );
  }
} 