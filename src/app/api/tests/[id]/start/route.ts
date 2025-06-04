import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import Test from '@/app/models/Test';
import Question from '@/app/models/Question';
import mongoose from 'mongoose';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const testId = params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return NextResponse.json({ error: 'Invalid test ID' }, { status: 400 });
    }

    // Fetch the test
    const test = await Test.findById(testId).lean();
    console.log("server test", test)
    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Fetch the questions related to this test
    const fallbackQuestions = await Question.find({ testId: test._id }).lean();

    // Choose questions: either from test.questions (if populated) or fallback
    const questionList =
      test.questions && test.questions.length > 0 && typeof test.questions[0] === 'object'
        ? test.questions
        : fallbackQuestions;

    // Format questions
    const formattedQuestions = questionList.map((q: any) => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
    }));

    return NextResponse.json({
      test: {
        id: test._id,
        title: test.title,
        description: test.description,
        duration: test.duration,
        totalMarks: test.totalMarks,
        passingMarks: test.passingMarks,
        questions: formattedQuestions,
      },
    });
  } catch (error) {
    console.error('Error fetching test details:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
