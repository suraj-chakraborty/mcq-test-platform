import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> } 
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Prisma doesn't have an exact findOneAndDelete, so we first find to check ownership
    const test = await prisma.descriptiveTest.findUnique({
      where: { id: id }
    });

    if (!test || test.userId !== session.user.id) {
      return NextResponse.json({ error: 'Test not found or unauthorized' }, { status: 404 });
    }

    await prisma.descriptiveTest.delete({
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