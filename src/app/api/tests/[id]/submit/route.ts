import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import Test from '@/app/models/Test';
import TestResult from '@/app/models/TestResult';
import Question from '@/app/models/Question';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }>}
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, answers } = await request.json();
    // console.log("Test ID:",id);
    // console.log("Answers:", answers);

    await connectDB();

    // Fetch test
    const test = await Test.findById(id);
    // console.log('Test data:', test);
    const questions = await Question.find({ testId: test._id});
    // console.log('Questions:', questions);
    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Choose questions: either from test.questions (if populated) or fallback
    const questionList =
      test.questions && test.questions.length > 0 && typeof test.questions[0] === 'object'
        ? test.questions
        : questions;

    // Calculate score and prepare question results
    let correctAnswers = 0;
    const questionResults = questionList.map((question: Question, index: number) => {
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
    const totalQuestions = test.questions.length;

    // Save test result
    const testResult = await TestResult.create({
      userId: session.user.id,
      testId: test.id||test._id,
      questions: questionResults,
      answers,
      score,
      passed: score >= (test.passingMarks / test.totalMarks) * 100,
      totalQuestions,
      correctAnswers,
      wrongAnswers: totalQuestions - correctAnswers,
      timeTaken: 0,
    });

    // Return test data along with results
    return NextResponse.json({
      success: true,
      attempt: {
        id: testResult._id,
        score,
        answers,
        totalQuestions,
        test: {
          id: test._id,
          title: test.title,
          questions: questionResults,
        },
        completedAt: testResult.createdAt,
      },
      attemptId: testResult._id,
    });
  } catch (error) {
    console.error('Error submitting test:', error);
    return NextResponse.json(
      { error: 'Failed to submit test' },
      { status: 500 }
    );
  }
} 