import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Analyze weak areas based on MCQ performance
    // We'll look at tests where the user scored < 60%
    const weakAttempts = await prisma.testAttempt.findMany({
      where: {
        userId,
        // Manual filter needed as we don't store percentage directly in DB comfortably for query
      },
      include: {
        test: {
          include: {
            questions: true
          }
        }
      }
    });

    const topicStats: Record<string, { total: number, correct: number }> = {};

    weakAttempts.forEach(attempt => {
      const qCount = attempt.test.questions.length;
      if (qCount === 0) return;
      
      const percentage = (attempt.score / qCount) * 100;
      const topic = attempt.test.title || 'General'; // Using title as a proxy for topic for now

      if (!topicStats[topic]) {
        topicStats[topic] = { total: 0, correct: 0 };
      }
      topicStats[topic].total += qCount;
      topicStats[topic].correct += attempt.score;
    });

    const weakAreas = Object.entries(topicStats)
      .map(([topic, stats]) => ({
        topic,
        accuracy: Math.round((stats.correct / stats.total) * 100),
        attempts: stats.total / (stats.total / 10) // rough proxy
      }))
      .filter(area => area.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy);

    return NextResponse.json({
      success: true,
      weakAreas: weakAreas.slice(0, 5)
    });

  } catch (error) {
    console.error('Weak areas error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
