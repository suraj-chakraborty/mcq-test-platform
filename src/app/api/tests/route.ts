import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import prisma from '../../../lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, duration, questions } = await req.json();

    // Validate input
    if (!title || !duration || !questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'Invalid test data' },
        { status: 400 }
      );
    }

    // Create test with questions
    const test = await prisma.test.create({
      data: {
        title,
        duration,
        userId: session.user.id,
        questions: {
          create: questions.map((q) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
          })),
        },
      },
      include: {
        questions: true,
      },
    });

    return NextResponse.json({
      message: 'Test created successfully',
      test,
    });
  } catch (error) {
    console.error('Error creating test:', error);
    return NextResponse.json(
      { error: 'Failed to create test' },
      { status: 500 }
    );
  }
}

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
          questions: {
            select: {
              id: true,
              question: true,
            },
          },
          _count: {
            select: {
              questions: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit
      }),
      prisma.test.count({ where })
    ]);

    return NextResponse.json({
      message: 'Tests fetched successfully',
      tests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching tests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tests' },
      { status: 500 }
    );
  }
} 