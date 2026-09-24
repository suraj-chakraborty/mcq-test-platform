import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const userId = session.user.id;

    // Analyze weak areas based on paginated window of recent attempts
    const [totalAttempts, attempts] = await Promise.all([
      prisma.testAttempt.count({ where: { userId } }),
      prisma.testAttempt.findMany({
        where: { userId },
        take: limit,
        skip: skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          score: true,
          test: {
            select: {
              title: true,
              questions: {
                select: { id: true },
              },
            },
          },
        },
      }),
    ]);

    const topicStats: Record<string, { totalQuestions: number; correct: number; attempts: number }> = {};

    attempts.forEach((attempt) => {
      if (!attempt.test?.questions) return;
      const qCount = attempt.test.questions.length;
      if (qCount === 0) return;

      const topic = attempt.test.title || 'General';

      if (!topicStats[topic]) {
        topicStats[topic] = { totalQuestions: 0, correct: 0, attempts: 0 };
      }
      topicStats[topic].totalQuestions += qCount;
      topicStats[topic].correct += Math.min(attempt.score, qCount);
      topicStats[topic].attempts += 1;
    });

    const weakAreas = Object.entries(topicStats)
      .map(([topic, stats]) => ({
        topic,
        accuracy: stats.totalQuestions > 0 ? Math.round((stats.correct / stats.totalQuestions) * 100) : 0,
        attempts: stats.attempts,
      }))
      .filter((area) => area.accuracy < 75)
      .sort((a, b) => a.accuracy - b.accuracy);

    return NextResponse.json({
      success: true,
      window: `last ${attempts.length} attempts`,
      weakAreas: weakAreas.slice(0, 5),
      pagination: {
        page,
        limit,
        totalAttempts,
        totalPages: Math.ceil(totalAttempts / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Weak areas error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
