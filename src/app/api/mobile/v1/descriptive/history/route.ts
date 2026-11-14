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
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '15')));
    const search = searchParams.get('search')?.trim() || '';
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {
      userId: user.id,
    };

    if (search) {
      where.OR = [
        { examName: { contains: search, mode: 'insensitive' } },
        { question: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tests, total] = await Promise.all([
      (prisma as any).descriptiveTest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).descriptiveTest.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      tests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching mobile descriptive history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch descriptive history' },
      { status: 500 }
    );
  }
}

