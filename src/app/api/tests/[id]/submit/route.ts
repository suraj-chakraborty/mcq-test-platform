import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { testAttemptSchema } from '@/lib/validations/test';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }>}
) {
  const routeId = (await params).id;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = testAttemptSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input', details: result.error.format() }, { status: 400 });
    }

    const { testId, answers } = result.data;
    const finalTestId = testId || routeId;

    const test = await prisma.test.findUnique({
      where: { id: finalTestId },
      include: { questions: true }
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    const questions = test.questions;
    let correctAnswers = 0;

    const questionResults = questions.map((question, index) => {
      const isCorrect = answers[index] === question.correctAnswer;
      if (isCorrect) correctAnswers++;
      return {
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        userAnswer: answers[index],
        isCorrect,
      };
    });

    const score = correctAnswers;
    const totalQuestions = questions.length;

    // Save test attempt
    const testAttempt = await prisma.testAttempt.create({
      data: {
        userId: session.user.id,
        testId: finalTestId,
        score,
        answers,
        completed: true,
        completedAt: new Date(),
      }
    });

    return NextResponse.json({
      success: true,
      attempt: {
        id: testAttempt.id,
        score,
        answers,
        totalQuestions,
        test: {
          id: test.id,
          title: test.title,
          questions: questionResults,
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