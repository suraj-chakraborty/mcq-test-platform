import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }>}
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

    const testAttempt = await prisma.testAttempt.findUnique({
      where: { id: id },
      include: {
        test: {
          include: {
            questions: true
          }
        }
      }
    });

    if (!testAttempt || testAttempt.userId !== session.user.id) {
      return NextResponse.json(
        { message: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Test fetched successfully',
      test: testAttempt,
    });
  } catch (error) {
    console.error('Test fetch error:', error);
    return NextResponse.json(
      { message: 'An error occurred while fetching the test' },
      { status: 500 }
    );
  }
}