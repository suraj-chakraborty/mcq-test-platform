import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    let user = await getMobileAuthUser(req);
    if (!user) {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        user = session.user as any;
      }
    }

    const resolvedParams = await Promise.resolve(params);
    const testId = resolvedParams.id;

    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
    }

    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: {
        id: true,
        title: true,
        _count: {
          select: { questions: true },
        },
      },
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    const totalQuestions = test._count.questions || 10;

    // Fetch attempts for this test, ordered by highest score then earliest completion
    const attempts = await prisma.testAttempt.findMany({
      where: {
        testId,
        completed: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: [
        { score: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 100,
    });

    // Deduplicate so each user appears once with their best attempt
    const seenUsers = new Set<string>();
    const uniqueLeaderboard: Array<{
      id: string;
      userId: string;
      name: string;
      image?: string | null;
      score: number;
      totalMarks: number;
      accuracy: string;
      rank: number;
      badge?: 'gold' | 'silver' | 'bronze';
      isCurrentUser: boolean;
      completedAt: Date;
    }> = [];

    let rankCounter = 1;
    let currentUserEntry: (typeof uniqueLeaderboard)[0] | null = null;

    for (const a of attempts) {
      const uId = a.userId || a.user?.id;
      if (!uId || seenUsers.has(uId)) continue;
      seenUsers.add(uId);

      const isCurrent = user?.id ? uId === user.id : false;
      const percentage = Math.round((a.score / totalQuestions) * 100);
      let badge: 'gold' | 'silver' | 'bronze' | undefined;
      if (rankCounter === 1) badge = 'gold';
      else if (rankCounter === 2) badge = 'silver';
      else if (rankCounter === 3) badge = 'bronze';

      const entry = {
        id: a.id,
        userId: uId,
        name: a.user?.name || (isCurrent ? 'You (Scholar)' : 'Candidate'),
        image: a.user?.image || null,
        score: a.score,
        totalMarks: totalQuestions,
        accuracy: `${Math.min(100, Math.max(0, percentage))}%`,
        rank: rankCounter,
        badge,
        isCurrentUser: isCurrent,
        completedAt: a.completedAt || a.createdAt,
      };

      if (isCurrent && !currentUserEntry) {
        currentUserEntry = entry;
      }

      if (uniqueLeaderboard.length < 20) {
        uniqueLeaderboard.push(entry);
      }

      rankCounter++;
    }

    return NextResponse.json({
      success: true,
      test: {
        id: test.id,
        title: test.title,
        totalQuestions,
      },
      leaderboard: uniqueLeaderboard,
      currentUserRank: currentUserEntry || null,
      totalParticipants: seenUsers.size,
    });
  } catch (error) {
    console.error('Error fetching mobile leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
