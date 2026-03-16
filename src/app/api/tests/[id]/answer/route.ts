import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }>}
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { questionIndex, answer } = await req.json();

    const attempt = await prisma.testAttempt.findUnique({
      where: { id },
      include: {
        test: {
          include: { questions: true }
        }
      }
    });

    if (!attempt || attempt.userId !== session.user.id) {
      return NextResponse.json(
        { message: 'Test Attempt not found' },
        { status: 404 }
      );
    }

    const test = attempt.test;

    if (questionIndex < 0 || questionIndex >= test.questions.length) {
      return NextResponse.json(
        { message: 'Invalid question index' },
        { status: 400 }
      );
    }

    // Update the answers array
    const newAnswers = [...attempt.answers];
    newAnswers[questionIndex] = answer;

    // Recalculate score
    let correctAnswersCount = 0;
    let wrongAnswersCount = 0;

    newAnswers.forEach((ans, idx) => {
      // It's possible some indices are undefined/null if answered out of order, check carefully
      if (ans === undefined || ans === null) return;
      if (ans === test.questions[idx].correctAnswer) {
        correctAnswersCount++;
      } else {
        wrongAnswersCount++;
      }
    });

    // Score calculation matching original (+1 for correct, -0.5 for wrong)
    const newScore = Math.max(0, correctAnswersCount - (wrongAnswersCount * 0.5));

    // Check if test is complete (all questions answered)
    const isComplete = newAnswers.length === test.questions.length && newAnswers.every(a => a !== undefined && a !== null);

    const updatedAttempt = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        answers: newAnswers,
        score: Math.round(newScore), // Store round integer score for TestAttempt, or adjust schema if float needed
        completed: isComplete,
        ...(isComplete ? { completedAt: new Date() } : {})
      }
    });

    return NextResponse.json({
      message: 'Answer submitted successfully',
      test: updatedAttempt, // return updated attempt
    });
  } catch (error) {
    console.error('Answer submission error:', error);
    return NextResponse.json(
      { message: 'An error occurred while submitting the answer' },
      { status: 500 }
    );
  }
}