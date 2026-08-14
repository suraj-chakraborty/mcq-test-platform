import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Analyze weak areas based on MCQ performance
    const attempts = await prisma.testAttempt.findMany({
      where: { userId },
      include: {
        test: {
          include: {
            questions: true,
          },
        },
      },
    });

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
      weakAreas: weakAreas.slice(0, 5),
    });
  } catch (error) {
    console.error('Weak areas error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
