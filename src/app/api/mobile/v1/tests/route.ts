import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    let user = await getMobileAuthUser(req);
    if (!user) {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        user = session.user as any;
      }
    }

    if (!user || !user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all'; // 'all' | 'mine'
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (filter === 'mine') {
      whereClause.userId = user.id;
    }

    if (search.trim()) {
      whereClause.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [tests, totalCount] = await Promise.all([
      prisma.test.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          description: true,
          duration: true,
          createdAt: true,
          userId: true,
          user: {
            select: {
              name: true,
              image: true,
            },
          },
          _count: {
            select: {
              questions: true,
              attempts: true,
            },
          },
          pdfs: {
            select: {
              id: true,
              name: true,
              fileSize: true,
            },
            take: 2,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.test.count({ where: whereClause }),
    ]);

    const formattedTests = tests.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      duration: t.duration || 20,
      questionCount: t._count.questions,
      attemptsCount: t._count.attempts,
      author: t.user?.name || 'Academic Scholar',
      isOwner: t.userId === user?.id,
      createdAt: t.createdAt,
      documents: t.pdfs.map((p) => p.name),
    }));

    return NextResponse.json({
      success: true,
      tests: formattedTests,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching mobile tests list:', error);
    return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 });
  }
}
