import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { calculateSM2 } from '@/app/lib/srs';
import { safeJsonParse } from '@/app/lib/validations/common';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reviewFlashcardSchema = z.object({
  quality: z.number().int().min(0, 'Quality score must be 0-5').max(5, 'Quality score must be 0-5'),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await Promise.resolve(params);
    const flashcardId = resolvedParams.id;

    if (!flashcardId) {
      return NextResponse.json({ error: 'Flashcard ID is required' }, { status: 400 });
    }

    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = reviewFlashcardSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const { quality } = validation.data;

    // Find the flashcard
    const flashcard = await prisma.flashcard.findUnique({
      where: { id: flashcardId },
      include: { question: true },
    });

    if (!flashcard || flashcard.userId !== user.id) {
      return NextResponse.json({ error: 'Flashcard not found' }, { status: 404 });
    }

    // Run refined SM-2 algorithm
    const { interval, repetition, easeFactor, nextReviewAt } = calculateSM2(
      quality,
      {
        interval: flashcard.interval,
        repetition: flashcard.repetition,
        easeFactor: flashcard.easeFactor,
      },
      flashcard.nextReviewAt
    );

    // Update in database
    const updated = await prisma.flashcard.update({
      where: { id: flashcardId },
      data: {
        interval,
        repetition,
        easeFactor,
        nextReviewAt,
      },
    });

    // Award +5 XP for flashcard revision
    try {
      await (prisma.user as any).update({
        where: { id: user.id },
        data: {
          xp: { increment: 5 },
        },
      });
    } catch (xpErr) {
      console.warn('Non-fatal XP increment error for flashcard:', xpErr);
    }

    return NextResponse.json({
      success: true,
      flashcard: {
        id: updated.id,
        interval: updated.interval,
        repetition: updated.repetition,
        easeFactor: updated.easeFactor,
        nextReviewAt: updated.nextReviewAt,
        daysUntilNextReview: updated.interval,
        xpAwarded: 5,
      },
    });
  } catch (error) {
    console.error('Error reviewing mobile flashcard:', error);
    return NextResponse.json({ error: 'Failed to record flashcard review' }, { status: 500 });
  }
}
