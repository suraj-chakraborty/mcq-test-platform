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

    // Utilize compound index [userId, createdAt] with pagination & ordering
    const [totalMcqTests, mcqAttempts, totalDescriptiveTests, descriptiveTests] = await Promise.all([
      prisma.testAttempt.count({ where: { userId } }),
      prisma.testAttempt.findMany({
        where: { userId },
        take: limit,
        skip: skip,
        orderBy: { createdAt: 'desc' },
        include: {
          test: {
            select: {
              title: true,
              questions: { select: { id: true } }
            }
          }
        }
      }),
      (prisma as any).descriptiveTest.count({ where: { userId } }),
      (prisma as any).descriptiveTest.findMany({
        where: { userId },
        take: limit,
        skip: skip,
        orderBy: { createdAt: 'desc' },
        select: { score: true, createdAt: true, examName: true }
      }),
    ]);

    // Calculate MCQ average score (normalized to percentage)
    let totalMcqPercentage = 0;
    let validMcqAttemptsCount = 0;

    mcqAttempts.forEach((attempt: any) => {
      const qCount = attempt.test?.questions?.length || 0;
      if (qCount > 0) {
        const attemptPercentage = (Math.min(attempt.score, qCount) / qCount) * 100;
        totalMcqPercentage += attemptPercentage;
        validMcqAttemptsCount++;
      }
    });

    const avgMcqScore = validMcqAttemptsCount > 0 ? totalMcqPercentage / validMcqAttemptsCount : 0;

    // Calculate Descriptive average score
    const totalDescScore = (descriptiveTests as any[]).reduce((acc: number, curr: any) => acc + (curr.score || 0), 0);
    const avgDescScore = totalDescriptiveTests > 0 ? totalDescScore / totalDescriptiveTests : 0;

    // Combined recent activity
    const activity = [
      ...mcqAttempts.map((a: any) => ({
        type: 'mcq',
        score: a.score,
        date: a.createdAt,
        title: a.test?.title || 'MCQ Test'
      })),
      ...(descriptiveTests as any[]).map((d: any) => ({
        type: 'descriptive',
        score: d.score,
        date: d.createdAt,
        title: d.examName || 'Descriptive Test'
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      summary: {
        totalTests: totalMcqTests + totalDescriptiveTests,
        avgMcqScore: Math.round(avgMcqScore),
        avgDescScore: Math.round(avgDescScore),
        recentActivity: activity.slice(0, 10),
        pagination: {
          page,
          limit,
          totalMcqTests,
          totalDescriptiveTests,
          totalTests: totalMcqTests + totalDescriptiveTests,
          totalPages: Math.ceil((totalMcqTests + totalDescriptiveTests) / limit) || 1,
        },
      }
    });

  } catch (error) {
    console.error('Analytics summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
