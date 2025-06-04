import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import Test from '@/app/models/Test';
import TestResult from '@/app/models/TestResult';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, answers } = await request.json();
    // console.log("id, answers", id ,answers)

    await connectDB();

    // Fetch test
    const test = await Test.findById(id);
    console.log("server test😎😍😍", test)

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Calculate score
    const score = answers.reduce((acc: number, answer: number, index: number) => {
      return acc + (answer === test.questions[index].correctAnswer ? 1 : 0);
    }, 0);

    // Save test result
    const testResult = await TestResult.create({
      userId: session.user.id,
      testId: test.id ||test._id,
      answers,
      score,
      passed: score >= (test.passingMarks / test.totalMarks) * 100,
      totalQuestions: test.questions.length,
      correctAnswers: score,
      wrongAnswers: test.questions.length - score,
      timeTaken: 0,
    });

    return NextResponse.json({
      success: true,
      attempt: {
        id: testResult._id,
        score,
        answers,
        totalQuestions: test.questions.length,
        test: {
          id: test._id,
          title: test.title,
          questions: test.questions,
        },
        completedAt: testResult.createdAt,
      },
      attemptId: testResult._id,
    });
  } catch (error) {
    // console.error('Error submitting test:', error);
    return NextResponse.json(
      { error: 'Failed to submit test' },
      { status: 500 }
    );
  }
} 