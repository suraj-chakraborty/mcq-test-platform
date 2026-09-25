import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { testAttemptSchema } from '@/app/lib/validations/test';
import {
  extractIdempotencyKey,
  acquireIdempotencyLock,
  releaseIdempotencyLock,
} from '@/app/lib/idempotency';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }>}
) {
  const routeId = (await params).id;
  let idempotencyKey: string | undefined;

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

    idempotencyKey = extractIdempotencyKey(request, body, {
      userId: session.user.id,
      testId: finalTestId,
    });

    const lockAcquired = await acquireIdempotencyLock(idempotencyKey, 60000);
    if (!lockAcquired) {
      return NextResponse.json(
        {
          error: 'A submission for this test is currently in progress. Please wait.',
          code: 'CONCURRENT_SUBMISSION',
        },
        { status: 409 }
      );
    }

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
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    // Check for recent duplicate attempt submitted in the last 10 seconds (double-click defense)
    let recentAttempt = null;
    if (typeof (prisma.testAttempt as any)?.findFirst === 'function') {
      try {
        recentAttempt = await (prisma.testAttempt as any).findFirst({
          where: {
            userId: session.user.id,
            testId: finalTestId,
            completed: true,
            completedAt: { gte: new Date(Date.now() - 10000) },
          },
          orderBy: { completedAt: 'desc' },
        });
      } catch {
        recentAttempt = null;
      }
    }

    if (recentAttempt && typeof recentAttempt.score === 'number' && recentAttempt.completedAt) {
      return NextResponse.json({
        success: true,
        attempt: {
          id: recentAttempt.id,
          score: recentAttempt.score,
          totalQuestions,
          percentage: totalQuestions > 0 ? Math.round((recentAttempt.score / totalQuestions) * 100) : 0,
        },
        results: questionResults,
        isDuplicate: true,
      });
    }


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


    // Gamification Integration
    let gamificationResult = null;
    try {
      const { processGamification } = await import('@/app/lib/gamification');
      gamificationResult = await processGamification(
        session.user.id,
        score,
        totalQuestions,
        0,
        testAttempt.id
      );
    } catch (gamificationError) {
      console.warn('Gamification processing skipped (non-fatal):', gamificationError);
    }

    return NextResponse.json({
      success: true,
      attempt: {
        id: testAttempt.id,
        score,
        totalQuestions,
        percentage,
        answers,
        test: {
          id: test.id,
          title: test.title,
          questions: questionResults,
        },
        completedAt: testAttempt.completedAt,
      },
      attemptId: testAttempt.id,
      gamification: gamificationResult
    });
  } catch (error) {
    console.error('Error submitting test:', error);
    return NextResponse.json(
      { error: 'Failed to submit test' },
      { status: 500 }
    );
  } finally {
    if (idempotencyKey) {
      await releaseIdempotencyLock(idempotencyKey);
    }
  }
}