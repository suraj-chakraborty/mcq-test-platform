import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: testId } = await params;

    // Fetch top 10 attempts for this test
    const attempts = await prisma.testAttempt.findMany({
      where: { testId },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { score: 'desc' },
        { createdAt: 'asc' } // Faster completion (earlier date) wins tie
      ],
      take: 10
    });

    return NextResponse.json({
      success: true,
      leaderboard: attempts.map((a: any) => ({
        id: a.id,
        userName: a.user?.name || 'Anonymous',
        score: a.score,
        date: a.createdAt
      }))
    });

  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
