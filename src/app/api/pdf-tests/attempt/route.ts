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

    // Calculate score
    let correctAnswers = 0;
    const questions = test.questions;

    questions.forEach((question, index) => {
      // Logic assumes answers is an object or array indexed by question index
      if (answers[index] === (question.correctAnswer + "")) { // Handling possible string conversion in legacy frontend
        correctAnswers++;
      } else if (answers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });

    const score = Math.round((correctAnswers / test.questions.length) * 100);

    // Save attempt
    const attempt = await prisma.testAttempt.create({
      data: {
        userId: session.user.id,
        testId,
        answers: Array.isArray(answers) ? answers.map(a => parseInt(a)) : [], // Convert to array of ints
        score,
        completed: true,
        completedAt: new Date(),
      }
    });

    // Gamification Integration
    const { processGamification } = await import('@/app/lib/gamification');
    const gamificationResult = await processGamification(
      session.user.id,
      score,
      test.questions.length,
      timeTaken || 0,
      attempt.id
    );

    return NextResponse.json({
      success: true,
      score,
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