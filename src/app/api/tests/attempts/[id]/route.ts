import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }>}
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const attemptId = id;
    
    // Check if attemptId is undefined or 'undefined'
    if (!attemptId || attemptId === 'undefined') {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');
      const skip = (page - 1) * limit;

      const where = { userId: session.user.id };

      // If no attemptId is provided, return all attempts for the user with pagination
      const [attempts, total] = await Promise.all([
        prisma.testAttempt.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.testAttempt.count({ where })
      ]);
      
      return NextResponse.json({
        success: true,
        attempts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    }

    // If attemptId is provided, find specific attempt
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            questions: true
          }
        }
      }
    });

    if (!attempt || attempt.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Test attempt not found' },
        { status: 404 }
      );
    }

    // Flatten for frontend
    const formattedAttempt = {
      ...attempt,
      questions: attempt.test.questions,
    };

    return NextResponse.json(formattedAttempt);
  } catch (error) {
    console.error('Error fetching test attempt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}