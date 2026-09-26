import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { safeJsonParse } from '@/app/lib/validations/common';
import { processGamification } from '@/app/lib/gamification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let user = await getMobileAuthUser(req);
    if (!user) {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        user = session.user as any;
      }
    }

    if (!user || !user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const testId = resolvedParams.id;

    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
    }

    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const body = parseResult.data || {};
    const { answers = {}, timeTakenSeconds = 0, negativeMarking = true } = body;

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        questions: true,
      },
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    if (test.questions.length === 0) {
      return NextResponse.json({ error: 'Test has no questions to grade' }, { status: 400 });
    }

    // Server-Authoritative Grading
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    const penaltyPerWrong = negativeMarking ? 0.25 : 0;

    const numericAnswersList: number[] = [];

    const detailedQuestions = test.questions.map((q, idx) => {
      // Support both map by question ID or array of indices
      let userChoice: number | undefined;
      if (Array.isArray(answers)) {
        userChoice = answers[idx];
      } else if (typeof answers === 'object' && answers !== null) {
        userChoice = answers[q.id];
      }

      const isAttempted = userChoice !== undefined && userChoice !== -1 && userChoice !== null;
      const isCorrect = isAttempted && userChoice === q.correctAnswer;

      if (!isAttempted || typeof userChoice !== 'number') {
        unattemptedCount++;
        numericAnswersList.push(-1);
      } else if (isCorrect) {
        correctCount++;
        numericAnswersList.push(userChoice);
      } else {
        incorrectCount++;
        numericAnswersList.push(userChoice);
      }

      return {
        id: q.id,
        question: q.question,
        options: q.options,
        userAnswer: isAttempted && typeof userChoice === 'number' ? userChoice : -1,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation || 'Detailed explanation not provided.',
        proofQuote: q.proofQuote || null,
        pageReference: q.pageReference || null,
      };
    });

    // Calculate marks with optional negative penalty
    const rawMarks = correctCount * 1.0 - incorrectCount * penaltyPerWrong;
    const finalScore = Math.max(0, parseFloat(rawMarks.toFixed(2)));
    const totalQuestions = test.questions.length;
    const accuracy =
      correctCount + incorrectCount > 0
        ? Math.round((correctCount / (correctCount + incorrectCount)) * 100)
        : 0;
    const percentage = Math.round((finalScore / totalQuestions) * 100);
    const passed = percentage >= 50;

    // Record attempt in database
    const attempt = await prisma.testAttempt.create({
      data: {
        userId: user.id,
        testId: test.id,
        score: Math.round(finalScore),
        answers: numericAnswersList,
        completed: true,
        completedAt: new Date(),
      },
    });

    // Gamification Integration (XP reward, streaks, achievements)
    let gamification: any = null;
    try {
      gamification = await processGamification(
        user.id,
        Math.round(finalScore),
        totalQuestions,
        timeTakenSeconds,
        attempt.id
      );
    } catch (gamifyErr) {
      console.warn('Gamification processing non-fatal error:', gamifyErr);
    }

    const minutes = Math.floor(timeTakenSeconds / 60);
    const seconds = timeTakenSeconds % 60;
    const timeTakenFormatted = `${minutes}m ${seconds}s`;

    return NextResponse.json({
      success: true,
      result: {
        attemptId: attempt.id,
        testId: test.id,
        testTitle: test.title,
        score: finalScore,
        totalMarks: totalQuestions,
        percentage,
        accuracy,
        correctCount,
        incorrectCount,
        unattemptedCount,
        status: passed ? 'PASSED' : 'FAILED',
        timeTaken: timeTakenFormatted,
        xpEarned: gamification?.xpEarned || (passed ? 50 : 20),
        questions: detailedQuestions,
        completedAt: attempt.completedAt,
      },
    });
  } catch (error) {
    console.error('Error submitting mobile test:', error);
    return NextResponse.json({ error: 'Failed to grade test submission' }, { status: 500 });
  }
}
