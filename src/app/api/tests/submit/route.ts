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

    // Calculate score
    const correctCount = (answers as number[]).reduce((acc: number, answer: number, index: number) => {
      if (answer === -1) return acc;
      return acc + (answer === test.questions[index].correctAnswer ? 1 : 0);
    }, 0);

    const score = Math.round(correctCount);

    // Save test result
    const testAttempt = await prisma.testAttempt.create({
      data: {
        userId: session.user.id,
        testId: test.id,
        answers: answers as number[],
        score,
        completed: true,
        completedAt: new Date(),
      },
    });

    // Gamification Integration
    const { processGamification } = await import('@/app/lib/gamification');
    const gamificationResult = await processGamification(
      session.user.id,
      score,
      test.questions.length,
      0, // Default time taken
      testAttempt.id
    );

    // Calculate detailed results for the frontend
    const detailedResults = test.questions.map((question: any, index: number) => {
      const userAnswerIndex = (answers as number[])[index];
      const isCorrect = userAnswerIndex === question.correctAnswer;
      return {
        question: question.question,
        yourAnswer: userAnswerIndex !== -1 ? question.options[userAnswerIndex] : 'Not Answered',
        correctAnswer: question.options[question.correctAnswer],
        isCorrect,
        explanation: question.explanation || ''
      };
    });

    const percentage = (score / test.questions.length) * 100;

    return NextResponse.json({
      success: true,
      attempt: {
        score,
        totalQuestions: test.questions.length,
        percentage,
        results: detailedResults,
        attemptId: testAttempt.id,
        testId: test.id,
        completedAt: testAttempt.completedAt,
      },
      gamification: gamificationResult
    });
  } catch (error) {
    console.error('Error submitting test:', error);
    return NextResponse.json(
      { error: 'Failed to submit test' },
      { status: 500 }
    );
  }
}