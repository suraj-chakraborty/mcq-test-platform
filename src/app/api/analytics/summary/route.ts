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

    // Use DB-side aggregations for totals and averages across the entire dataset (never from a paginated window)
    const [mcqAgg, descAgg, mcqAttempts, descriptiveTests] = await Promise.all([
      prisma.testAttempt.aggregate({
        where: { userId },
        _count: { _all: true },
        _avg: { score: true },
      }),
      (prisma as any).descriptiveTest.aggregate({
        where: { userId },
        _count: { _all: true },
        _avg: { score: true },
      }),
      prisma.testAttempt.findMany({
        where: { userId },
        take: limit,
        skip: skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          score: true,
          createdAt: true,
          test: {
            select: {
              title: true,
            },
          },
        },
      }),
      (prisma as any).descriptiveTest.findMany({
        where: { userId },
        take: limit,
        skip: skip,
        orderBy: { createdAt: 'desc' },
        select: { score: true, createdAt: true, examName: true },
      }),
    ]);

    const totalMcqTests = mcqAgg._count?._all || 0;
    const totalDescriptiveTests = descAgg._count?._all || 0;
    const avgMcqScore = Math.round(mcqAgg._avg?.score || 0);
    const avgDescScore = Math.round(descAgg._avg?.score || 0);

    // Combined recent activity from paginated window
    const activity = [
      ...mcqAttempts.map((a: any) => ({
        type: 'mcq',
        score: a.score,
        date: a.createdAt,
        title: a.test?.title || 'MCQ Test',
      })),
      ...(descriptiveTests as any[]).map((d: any) => ({
        type: 'descriptive',
        score: d.score,
        date: d.createdAt,
        title: d.examName || 'Descriptive Test',
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      summary: {
        totalTests: totalMcqTests + totalDescriptiveTests,
        avgMcqScore,
        avgDescScore,
        recentActivity: activity.slice(0, 10),
        pagination: {
          page,
          limit,
          totalMcqTests,
          totalDescriptiveTests,
          totalTests: totalMcqTests + totalDescriptiveTests,
          totalPages: Math.ceil((totalMcqTests + totalDescriptiveTests) / limit) || 1,
        },
      },
    });

  } catch (error) {
    console.error('Analytics summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
