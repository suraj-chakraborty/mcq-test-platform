import { NextResponse } from 'next/server';
import { resolveAuthUser } from '@/app/lib/mobileAuth';
import { prisma } from '@/app/lib/prisma';

export async function GET(request: Request) {
  try {
    const user = await resolveAuthUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    const where = { userId: user.id };

    const [attempts, total] = await Promise.all([
      prisma.testAttempt.findMany({
        where,
        include: {
          test: {
            select: {
              id: true,
              title: true,
              duration: true,
              _count: {
                select: { questions: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.testAttempt.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: attempts.map((att) => ({
        id: att.id,
        testId: att.testId,
        testTitle: att.test?.title || 'Assessment',
        score: att.score,
        completed: att.completed,
        xpEarned: att.xpEarned,
        createdAt: att.createdAt,
        completedAt: att.completedAt,
        totalQuestions: att.test?._count?.questions || 0,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching mobile test attempts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test attempts' },
      { status: 500 }
    );
  }
}
