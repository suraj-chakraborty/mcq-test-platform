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

    const { testId, answers, timeTaken } = await request.json();

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
      gamification: gamificationResult
    });

  } catch (error) {
    console.error('Error submitting test attempt:', error);
    return NextResponse.json(
      { error: 'Failed to submit test attempt' },
      { status: 500 }
    );
  }
}