import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
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

    const { searchParams } = new URL(req.url);
    const attemptId = searchParams.get('attemptId');

    // Find the attempt
    let attempt;
    if (attemptId) {
      attempt = await prisma.testAttempt.findFirst({
        where: {
          id: attemptId,
          testId,
          userId: user.id,
        },
        include: {
          test: {
            include: {
              questions: true,
            },
          },
        },
      });
    } else {
      // Find latest completed attempt for this test & user
      attempt = await prisma.testAttempt.findFirst({
        where: {
          testId,
          userId: user.id,
          completed: true,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          test: {
            include: {
              questions: true,
            },
          },
        },
      });
    }

    if (!attempt || !attempt.test) {
      return NextResponse.json(
        { error: 'No completed attempt found for this assessment' },
        { status: 404 }
      );
    }

    const test = attempt.test;
    const userAnswers = (attempt.answers as number[]) || [];

    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    const detailedQuestions = test.questions.map((q, idx) => {
      const userChoice = idx < userAnswers.length ? userAnswers[idx] : -1;
      const isAttempted = userChoice !== undefined && userChoice !== -1 && userChoice !== null;
      const isCorrect = isAttempted && userChoice === q.correctAnswer;

      if (!isAttempted) {
        unattemptedCount++;
      } else if (isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
      }

      return {
        id: q.id,
        question: q.question,
        options: q.options,
        userAnswer: isAttempted ? userChoice : -1,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation || 'Comprehensive solution breakdown is verified from source materials.',
        proofQuote: q.proofQuote || null,
        pageReference: q.pageReference || null,
        citationType: q.citationType || 'VERBATIM_PROOF',
      };
    });

    const totalQuestions = test.questions.length;
    const finalScore = attempt.score;
    const accuracy =
      correctCount + incorrectCount > 0
        ? Math.round((correctCount / (correctCount + incorrectCount)) * 100)
        : 0;
    const percentage = totalQuestions > 0 ? Math.round((finalScore / totalQuestions) * 100) : 0;
    const passed = percentage >= 50;

    // Leaderboard ranking context
    const higherScoreCount = await prisma.testAttempt.count({
      where: {
        testId,
        score: { gt: attempt.score },
      },
    });
    const totalParticipants = await prisma.testAttempt.count({
      where: { testId },
    });

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
        rank: higherScoreCount + 1,
        totalParticipants: Math.max(1, totalParticipants),
        questions: detailedQuestions,
        completedAt: attempt.completedAt || attempt.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching mobile test results:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
