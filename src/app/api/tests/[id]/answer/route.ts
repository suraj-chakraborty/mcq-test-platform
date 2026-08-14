import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { questionIndex, answer } = await req.json();

    // 1. Check if `id` is a direct TestAttempt ID
    let attempt = await prisma.testAttempt.findUnique({
      where: { id },
      include: {
        test: {
          include: { questions: true }
        }
      }
    });

    // 2. If not found by attempt ID, check if `id` is a Test ID and find/create an active attempt
    if (!attempt) {
      const test = await prisma.test.findUnique({
        where: { id },
        include: { questions: true }
      });

      if (!test) {
        return NextResponse.json(
          { message: 'Test not found' },
          { status: 404 }
        );
      }

      // Find an incomplete attempt or create a new one
      attempt = await prisma.testAttempt.findFirst({
        where: {
          testId: id,
          userId: session.user.id,
          completed: false,
        },
        include: {
          test: {
            include: { questions: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!attempt) {
        attempt = await prisma.testAttempt.create({
          data: {
            userId: session.user.id,
            testId: id,
            score: 0,
            answers: new Array(test.questions.length).fill(-1),
            completed: false,
          },
          include: {
            test: {
              include: { questions: true }
            }
          }
        });
      }
    }

    if (!attempt || attempt.userId !== session.user.id) {
      return NextResponse.json(
        { message: 'Unauthorized or attempt not found' },
        { status: 404 }
      );
    }

    const test = attempt.test;

    if (questionIndex < 0 || questionIndex >= test.questions.length) {
      return NextResponse.json(
        { message: 'Invalid question index' },
        { status: 400 }
      );
    }

    // Convert answer to integer index if passed as option string
    let answerIndex: number;
    if (typeof answer === 'number') {
      answerIndex = answer;
    } else {
      const matchedIdx = test.questions[questionIndex].options.indexOf(answer);
      answerIndex = matchedIdx !== -1 ? matchedIdx : parseInt(answer, 10);
    }

    // Update the answers array
    const newAnswers = [...attempt.answers];
    while (newAnswers.length < test.questions.length) {
      newAnswers.push(-1);
    }
    newAnswers[questionIndex] = isNaN(answerIndex) ? -1 : answerIndex;

    // Recalculate score
    let correctAnswersCount = 0;
    let wrongAnswersCount = 0;

    newAnswers.forEach((ans, idx) => {
      if (ans === undefined || ans === null || ans === -1) return;
      if (ans === test.questions[idx].correctAnswer) {
        correctAnswersCount++;
      } else {
        wrongAnswersCount++;
      }
    });

    const newScore = correctAnswersCount;
    const isComplete = newAnswers.length === test.questions.length && newAnswers.every(a => a !== -1);

    const updatedAttempt = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        answers: newAnswers,
        score: newScore,
        completed: isComplete,
        ...(isComplete ? { completedAt: new Date() } : {})
      }
    });

    return NextResponse.json({
      message: 'Answer submitted successfully',
      test: {
        ...updatedAttempt,
        totalQuestions: test.questions.length,
        correctAnswers: correctAnswersCount,
        wrongAnswers: wrongAnswersCount,
        questions: test.questions,
      },
    });
  } catch (error) {
    console.error('Answer submission error:', error);
    return NextResponse.json(
      { message: 'An error occurred while submitting the answer' },
      { status: 500 }
    );
  }
}