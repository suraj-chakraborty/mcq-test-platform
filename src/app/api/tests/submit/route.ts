import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, answers } = await request.json();

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: true,
      },
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Calculate score
    const correctCount = answers.reduce((acc: number, answer: number, index: number) => {
      if (answer === null || answer === undefined) return acc;
      return acc + (answer === test.questions[index].correctAnswer ? 1 : 0);
    }, 0);

    const score = Math.round(correctCount); // Storing integer score

    // Save test result (TestAttempt)
    const testAttempt = await prisma.testAttempt.create({
      data: {
        userId: session.user.id,
        testId: test.id,
        answers,
        score,
        completed: true,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      attempt: {
        id: testAttempt.id,
        score,
        answers,
        totalQuestions: test.questions.length,
        test: {
          id: test.id,
          title: test.title,
          questions: test.questions,
        },
        completedAt: testAttempt.completedAt,
      },
      attemptId: testAttempt.id,
    });
  } catch (error) {
    console.error('Error submitting test:', error);
    return NextResponse.json(
      { error: 'Failed to submit test' },
      { status: 500 }
    );
  }
}