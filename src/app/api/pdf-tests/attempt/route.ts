import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { objectIdSchema, safeJsonParse } from '@/app/lib/validations/common';
import {
  extractIdempotencyKey,
  acquireIdempotencyLock,
  releaseIdempotencyLock,
} from '@/app/lib/idempotency';

const attemptSubmissionSchema = z.object({
  testId: objectIdSchema,
  answers: z.union([
    z.array(z.number().int().min(-1).max(10)),
    z.record(z.string().regex(/^\d+$/), z.number().int().min(-1).max(10))
  ]),
  timeTaken: z.number().nonnegative().max(86400).optional().default(0),
}).strict();

export async function POST(request: Request) {
  let idempotencyKey: string | undefined;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parseResult = await safeJsonParse(request);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = attemptSubmissionSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid attempt submission data', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { testId, answers, timeTaken } = validation.data;

    idempotencyKey = extractIdempotencyKey(request, validation.data, {
      userId: session.user.id,
      testId,
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
      where: { id: testId },
      include: { questions: true }
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Parse answers whether submitted as an array or object map
    const questions = test.questions;
    const answersArray: number[] = questions.map((_, index) => {
      if (Array.isArray(answers)) {
        const val = answers[index];
        return typeof val === 'number' ? val : parseInt(val ?? '-1', 10);
      } else if (answers && typeof answers === 'object') {
        const val = answers[index] ?? answers[String(index)];
        return val !== undefined && val !== null ? parseInt(String(val), 10) : -1;
      }
      return -1;
    });

    // Calculate raw correct answers count
    let correctAnswers = 0;
    questions.forEach((question, index) => {
      if (answersArray[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });

    const rawScore = correctAnswers;
    const percentage = Math.round((correctAnswers / questions.length) * 100);

    // Grade questions server-side and reveal answers and explanations post-submit
    const gradedQuestions = questions.map((question, index) => ({
      ...question,
      userAnswer: answersArray[index],
      isCorrect: answersArray[index] === question.correctAnswer,
    }));

    // Check for recent duplicate attempt submitted in the last 10 seconds (double-click defense)
    let recentAttempt = null;
    if (typeof (prisma.testAttempt as any)?.findFirst === 'function') {
      try {
        recentAttempt = await (prisma.testAttempt as any).findFirst({
          where: {
            userId: session.user.id,
            testId,
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
        score: recentAttempt.score,
        totalQuestions: questions.length,
        percentage: Math.round((recentAttempt.score / questions.length) * 100),
        attempt: recentAttempt,
        questions: gradedQuestions,
        isDuplicate: true,
      });
    }


    // Save attempt with raw correct count as score
    const attempt = await prisma.testAttempt.create({
      data: {
        userId: session.user.id,
        testId,
        answers: answersArray,
        score: rawScore,
        completed: true,
        completedAt: new Date(),
      }
    });

    // Gamification Integration
    const { processGamification } = await import('@/app/lib/gamification');
    const gamificationResult = await processGamification(
      session.user.id,
      rawScore,
      test.questions.length,
      timeTaken || 0,
      attempt.id
    );

    return NextResponse.json({
      success: true,
      score: rawScore,
      totalQuestions: questions.length,
      percentage,
      attempt,
      questions: gradedQuestions,
      gamification: gamificationResult
    });

  } catch (error) {
    console.error('Error submitting test attempt:', error);
    return NextResponse.json(
      { error: 'Failed to submit test attempt' },
      { status: 500 }
    );
  } finally {
    if (idempotencyKey) {
      await releaseIdempotencyLock(idempotencyKey);
    }
  }
}
