import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

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

    const test = await prisma.test.findUnique({
      where: { id: id }
    });

    if (!test || test.userId !== session.user.id) {
      return NextResponse.json({ error: 'Test not found or unauthorized' }, { status: 404 });
    }

    await prisma.test.delete({
      where: { id: id }
    });

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }>}
) {
  const id = (await params).id;
  // The original Mongoose code didn't actually update any fields.
  // We'll leave this as a stub that just verifies ownership for now.
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const test = await prisma.test.findUnique({
      where: { id }
    });

    if (!test || test.userId !== session.user.id) {
      return NextResponse.json({ error: 'Test not found or unauthorized' }, { status: 404 });
    }

    // Example of how you would update it later:
    // await prisma.test.update({ where: { id }, data: { title: "updated title" } });

    return NextResponse.json({
      success: true,
      message: 'Test updated successfully'
    });

  } catch (error) {
    console.error('Error updating test:', error);
    return NextResponse.json(
      { error: 'Failed to update test' },
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

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: true,
        pdfs: true
      }
    });

    if (!test || test.userId !== session.user.id) {
      return NextResponse.json({ error: 'Test not found or unauthorized' }, { status: 404 });
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