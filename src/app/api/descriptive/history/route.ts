import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { paginationQuerySchema } from '@/app/lib/validations/common';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = paginationQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    const { page, limit, search } = parsedQuery.success
      ? parsedQuery.data
      : { page: 1, limit: 10, search: '' };
    const skip = (page - 1) * limit;

    const where = {
      userId: session.user.id,
      ...(search ? {
        examName: {
          contains: search,
          mode: 'insensitive' as any
        }
      } : {})
    };

    const [tests, total] = await Promise.all([
      (prisma as any).descriptiveTest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      (prisma as any).descriptiveTest.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      tests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching test history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test history' },
      { status: 500 }
    );
  }
}