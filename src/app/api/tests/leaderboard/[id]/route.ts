import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { objectIdSchema } from '@/app/lib/validations/common';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: testId } = await params;
    const idValidation = objectIdSchema.safeParse(testId);
    if (!idValidation.success) {
      return NextResponse.json({ error: 'Invalid test ID format' }, { status: 400 });
    }

    // Fetch attempts for this test
    const attempts = await prisma.testAttempt.findMany({
      where: { testId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { score: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 50,
    });

    // Deduplicate by user so each user appears only once with their best score
    const seenUsers = new Set<string>();
    const uniqueLeaderboard: any[] = [];

    for (const a of attempts) {
      const userId = a.userId || a.user?.id || a.id;
      if (!seenUsers.has(userId)) {
        seenUsers.add(userId);
        uniqueLeaderboard.push({
          id: a.id,
          userName: a.user?.name || 'Candidate',
          score: a.score,
          date: a.createdAt,
        });
      }
      if (uniqueLeaderboard.length >= 10) break;
    }


    return NextResponse.json({
      success: true,
      leaderboard: uniqueLeaderboard,
    });

  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
