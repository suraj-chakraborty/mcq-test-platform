import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

/**
 * GET: Fetch flashcards due for review
 * POST: Create flashcards from a Test
 */

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      }
    });

    return NextResponse.json({ success: true, flashcards });
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

    const { testId } = await request.json();
    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
    }

    // Get all questions from the test
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { questions: true }
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
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
