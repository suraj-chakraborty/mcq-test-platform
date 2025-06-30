import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import DescriptiveTest from '@/app/models/DescriptiveTest';

export async function DELETE(
  request: Request,
    { params }: { params: Promise<{ id: string }> } 
) {
  const  id  = (await params).id
  // console.log("context", context)
  // console.log("id",id)
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const test = await DescriptiveTest.findOneAndDelete({
      _id: id,
      userId: session.user.id
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Test deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting test:', error);
    return NextResponse.json(
      { error: 'Failed to delete test' },
      { status: 500 }
    );
  }
} 