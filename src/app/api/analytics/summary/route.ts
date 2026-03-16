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

    // Fetch MCQ attempts
    const mcqAttempts = await prisma.testAttempt.findMany({
      where: { userId },
      select: { score: true, createdAt: true, test: { select: { questions: { select: { id: true } } } } }
    });

    // Fetch Descriptive tests
    const descriptiveTests = await (prisma as any).descriptiveTest.findMany({
      where: { userId },
      select: { score: true, createdAt: true, examName: true }
    });

    const totalMcqTests = mcqAttempts.length;
    const totalDescriptiveTests = (descriptiveTests as any[]).length;

    // Calculate MCQ average score (normalized to 100)
    let totalMcqScore = 0;
    mcqAttempts.forEach((attempt: any) => {
      const qCount = attempt.test.questions.length || 1;
      totalMcqScore += (attempt.score / qCount) * 100;
    });
    const avgMcqScore = totalMcqTests > 0 ? totalMcqScore / totalMcqTests : 0;

    // Calculate Descriptive average score
    const totalDescScore = (descriptiveTests as any[]).reduce((acc: number, curr: any) => acc + curr.score, 0);
    const avgDescScore = totalDescriptiveTests > 0 ? totalDescScore / totalDescriptiveTests : 0;

    // Combined recent activity
    const activity = [
      ...mcqAttempts.map((a: any) => ({ type: 'mcq', score: a.score, date: a.createdAt })),
      ...(descriptiveTests as any[]).map((d: any) => ({ type: 'descriptive', score: d.score, date: d.createdAt, title: d.examName }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      summary: {
        totalTests: totalMcqTests + totalDescriptiveTests,
        avgMcqScore: Math.round(avgMcqScore),
        avgDescScore: Math.round(avgDescScore),
        recentActivity: activity.slice(0, 10)
      }
    });

  } catch (error) {
    console.error('Analytics summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
