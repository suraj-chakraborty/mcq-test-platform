import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questions } = await request.json();

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'Invalid questions data' },
        { status: 400 }
      );
    }

    const test = await prisma.test.findUnique({
      where: { id, userId: session.user.id }
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Update questions: Delete old ones and create new ones
    await prisma.$transaction([
      prisma.question.deleteMany({ where: { testId: id } }),
      prisma.question.createMany({
        data: questions.map((q: any) => ({
          testId: id,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium'
        }))
      })
    ]);

    const updatedTest = await prisma.test.findUnique({
      where: { id },
      include: { questions: true }
    });

    return NextResponse.json({
      success: true,
      test: updatedTest
    });

  } catch (error) {
    console.error('Error updating questions:', error);
    return NextResponse.json(
      { error: 'Failed to update questions' },
      { status: 500 }
    );
  }
}