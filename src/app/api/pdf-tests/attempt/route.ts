import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import PDFTest from '@/app/models/PDFTest';
import TestAttempt from '@/app/models/TestAttempt';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { testId, answers, timeTaken } = await request.json();

    await connectDB();

    const test = await PDFTest.findById(testId);
    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Calculate score
    let correctAnswers = 0;
    test.questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });

    const score = Math.round((correctAnswers / test.questions.length) * 100);

    // Save attempt
    const attempt = await TestAttempt.create({
      userId: session.user.id,
      testId,
      answers,
      score,
      timeTaken
    });

    return NextResponse.json({
      success: true,
      score,
      attempt
    });

  } catch (error) {
    console.error('Error submitting test attempt:', error);
    return NextResponse.json(
      { error: 'Failed to submit test attempt' },
      { status: 500 }
    );
  }
} 