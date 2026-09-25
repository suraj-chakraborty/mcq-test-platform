import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { safeJsonParse } from '@/app/lib/validations/common';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createFlashcardsSchema = z.object({
  testId: z.string().min(1, 'Test ID is required'),
});

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const dueOnly = searchParams.get('dueOnly') !== 'false'; // default to true
    const skip = (page - 1) * limit;

    const now = new Date();
    const whereClause: any = {
      userId: user.id,
    };

    if (dueOnly) {
      whereClause.nextReviewAt = { lte: now };
    }

    const [flashcards, dueCount, totalCount] = await Promise.all([
      prisma.flashcard.findMany({
        where: whereClause,
        include: {
          question: {
            select: {
              id: true,
              question: true,
              options: true,
              correctAnswer: true,
              explanation: true,
              proofQuote: true,
              pageReference: true,
              citationType: true,
              difficulty: true,
            },
          },
        },
        orderBy: {
          nextReviewAt: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.flashcard.count({
        where: {
          userId: user.id,
          nextReviewAt: { lte: now },
        },
      }),
      prisma.flashcard.count({
        where: {
          userId: user.id,
        },
      }),
    ]);

    // Format cards for the mobile client
    const formatted = flashcards.map((fc) => ({
      id: fc.id,
      questionId: fc.questionId,
      front: fc.question?.question || 'Question content not found',
      back:
        fc.question && fc.question.options && fc.question.correctAnswer !== undefined
          ? fc.question.options[fc.question.correctAnswer]
          : 'Answer not available',
      options: fc.question?.options || [],
      correctAnswerIndex: fc.question?.correctAnswer ?? 0,
      explanation: fc.question?.explanation || '',
      proofQuote: fc.question?.proofQuote || null,
      pageReference: fc.question?.pageReference || null,
      difficulty: fc.question?.difficulty || 'medium',
      interval: fc.interval,
      repetition: fc.repetition,
      easeFactor: fc.easeFactor,
      nextReviewAt: fc.nextReviewAt,
    }));

    return NextResponse.json({
      success: true,
      flashcards: formatted,
      dueCount,
      totalCount,
      pagination: {
        page,
        limit,
        total: dueOnly ? dueCount : totalCount,
        totalPages: Math.ceil((dueOnly ? dueCount : totalCount) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching mobile flashcards:', error);
    return NextResponse.json({ error: 'Failed to fetch flashcards' }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = createFlashcardsSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const { testId } = validation.data;

    // Retrieve test with its questions
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { questions: true },
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Security/Integrity Check: user must own the test OR have completed an attempt for it
    if (test.userId !== user.id) {
      const completedAttempt = await prisma.testAttempt.findFirst({
        where: {
          testId,
          userId: user.id,
          completed: true,
        },
      });

      if (!completedAttempt) {
        return NextResponse.json(
          {
            error: 'Forbidden: You cannot generate flashcards for an incomplete or unauthorized assessment',
          },
          { status: 403 }
        );
      }
    }

    if (!test.questions || test.questions.length === 0) {
      return NextResponse.json(
        { error: 'This assessment does not contain any questions to convert' },
        { status: 400 }
      );
    }

    // Upsert flashcards for each question
    const flashcardPromises = test.questions.map((q) =>
      prisma.flashcard.upsert({
        where: {
          userId_questionId: {
            userId: user.id,
            questionId: q.id,
          },
        },
        update: {}, // Keep existing review progress if card already exists
        create: {
          userId: user.id,
          questionId: q.id,
          interval: 0,
          repetition: 0,
          easeFactor: 2.5,
          nextReviewAt: new Date(),
        },
      })
    );

    const createdFlashcards = await Promise.all(flashcardPromises);

    return NextResponse.json({
      success: true,
      message: `Successfully generated ${createdFlashcards.length} flashcards from "${test.title}"`,
      deckSize: createdFlashcards.length,
      testTitle: test.title,
    });
  } catch (error) {
    console.error('Error creating mobile flashcards:', error);
    return NextResponse.json({ error: 'Failed to create flashcards' }, { status: 500 });
  }
}
