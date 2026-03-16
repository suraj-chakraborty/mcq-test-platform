import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    const where = {
      userId: session.user.id,
      pdfs: { some: {} },
      ...(search ? {
        title: {
          contains: search,
          mode: 'insensitive' as any
        }
      } : {})
    };

    const [tests, total] = await Promise.all([
      prisma.test.findMany({
        where,
        include: {
          pdfs: true,
          questions: true
        } as any,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.test.count({ where })
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
    console.error('Error fetching PDF tests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tests' },
      { status: 500 }
    );
  }
}