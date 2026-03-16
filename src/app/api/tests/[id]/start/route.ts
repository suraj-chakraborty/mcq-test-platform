import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }>}
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the test
    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: true
      }
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Format questions
    const formattedQuestions = test.questions.map((q) => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
    }));

    return NextResponse.json({
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        duration: test.duration,
        totalMarks: formattedQuestions.length,
        passingMarks: Math.ceil(formattedQuestions.length * 0.4), // Example logic
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

