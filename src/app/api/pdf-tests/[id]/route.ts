import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import PDFTest from '@/app/models/PDFTest';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }>}
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const test = await PDFTest.findOneAndDelete({
      _id: id,
      userId: session.user.id
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
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

export async function PUT(  request: Request,
  { params }: { params: Promise<{ id: string }>}) {
    const id = (await params).id;
    const { data } = await request.json();

    console.log("data", data);
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
  
      await connectDB();
  
      const test = await PDFTest.findOneAndUpdate({
        _id: id,
        userId: session.user.id
      });
  
      if (!test) {
        return NextResponse.json(
          { error: 'Test not found' },
          { status: 404 }
        );
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }>}
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const test = await PDFTest.findById(id);
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
    console.error('Error fetching test:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test' },
      { status: 500 }
    );
  }
}