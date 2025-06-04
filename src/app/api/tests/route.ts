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

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tests = await prisma.test.findMany({
      where: {
        userId: session.user.id,
      },
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
    });

    return NextResponse.json({
      message: 'Tests fetched successfully',
      tests,
    });
  } catch (error) {
    console.error('Error fetching tests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tests' },
      { status: 500 }
    );
  }
} 