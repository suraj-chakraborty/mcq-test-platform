import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const test = await prisma.test.findUnique({
      where: { id }
    });

    if (!test || test.userId !== session.user.id) {
      return NextResponse.json(
        { message: 'Test not found or unauthorized' },
        { status: 404 }
      );
    }
    
    await prisma.test.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Test deleted successfully',
      test,
    });
  } catch (error) {
    console.error('Test delete error:', error);
    return NextResponse.json(
      { message: 'An error occurred while deleting the test' },
      { status: 500 }
    );
  }
}