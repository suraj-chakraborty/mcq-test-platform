import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import TestResult from '@/app/models/TestResult';

interface Question {
  userAnswer: string;
  correctAnswer: number;
  isCorrect: boolean;
}

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

    await connectDB();

    const test = await TestResult.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!test) {
      return NextResponse.json(
        { message: 'Test not found' },
        { status: 404 }
      );
    }

    if (questionIndex >= test.questions.length) {
      return NextResponse.json(
        { message: 'Invalid question index' },
        { status: 400 }
      );
    }

    const question = test.questions[questionIndex];
    const isCorrect = answer === question.correctAnswer;

    // Update question
    question.userAnswer = answer;
    question.isCorrect = isCorrect;

    // Update test statistics
    if (isCorrect) {
      test.correctAnswers += 1;
    } else {
      test.wrongAnswers += 1;
    }

    // Calculate score (+1 for correct, -0.5 for wrong)
    test.score = test.correctAnswers - (test.wrongAnswers * 0.5);

    // Check if test is complete
    const isComplete = test.questions.every((q: Question) => q.userAnswer !== '');
    if (isComplete) {
      test.completed = true;
    }

    await test.save();

    return NextResponse.json({
      message: 'Answer submitted successfully',
      test,
    });
  } catch (error) {
    console.error('Answer submission error:', error);
    return NextResponse.json(
      { message: 'An error occurred while submitting the answer' },
      { status: 500 }
    );
  }
} 