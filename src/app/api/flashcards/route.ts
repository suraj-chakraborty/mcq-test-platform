import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { objectIdSchema, paginationQuerySchema, safeJsonParse } from '@/app/lib/validations/common';
import { z } from 'zod';

const createFlashcardSchema = z
  .object({
    testId: objectIdSchema,
  })
  .strict();

/**
 * GET: Fetch flashcards due for review
 * POST: Create flashcards from a Test
 */

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);

    const queryParams = Object.fromEntries(url.searchParams.entries());
    const queryParsed = paginationQuerySchema.safeParse(queryParams);
    const { page, limit } = queryParsed.success ? queryParsed.data : { page: 1, limit: 50 };
    const skip = (page - 1) * limit;


    const now = new Date();
    const flashcards = await prisma.flashcard.findMany({
      where: {
        userId: session.user.id,
        nextReviewAt: { lte: now }
      },
      include: {
        question: true
      },
      orderBy: {
        nextReviewAt: 'asc'
      },
      skip,
      take: limit,
    });

    return NextResponse.json({ success: true, flashcards, page, limit });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parseResult = await safeJsonParse(request);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const schemaResult = createFlashcardSchema.safeParse(parseResult.data);
    if (!schemaResult.success) {
      return NextResponse.json(
        { error: 'Invalid input: valid testId is required', details: schemaResult.error.format() },
        { status: 400 }
      );
    }
    const { testId } = schemaResult.data;

    // Get all questions from the test
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { questions: true }
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    if (test.userId !== session.user.id) {
      const hasCompletedAttempt = await prisma.testAttempt.findFirst({
        where: { testId, userId: session.user.id, completed: true }
      });
      if (!hasCompletedAttempt) {
        return NextResponse.json(
          { error: 'Forbidden: You cannot generate flashcards for an incomplete or unauthorized test' },
          { status: 403 }
        );
      }
    }

    // Bulk create flashcards, skipping duplicates
    const flashcardData = test.questions.map(q => ({
      userId: session.user.id,
      questionId: q.id,
      nextReviewAt: new Date(),
    }));

    // Prisma doesn't have createMany for MongoDB with unique constraints well handled in one go sometimes,
    // so we'll do it safely.
    const results = await Promise.all(
      flashcardData.map(data => 
        prisma.flashcard.upsert({
          where: {
            userId_questionId: {
              userId: data.userId,
              questionId: data.questionId
            }
          },
          update: {}, // Don't reset if it exists
          create: data
        })
      )
    );

    return NextResponse.json({ success: true, count: results.length });
  } catch (error) {
    console.error('Error creating flashcards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
