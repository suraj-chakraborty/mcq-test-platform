import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { calculateSM2 } from '@/app/lib/srs';
import { objectIdSchema, safeJsonParse } from '@/app/lib/validations/common';
import { z } from 'zod';

const reviewSchema = z
  .object({
    quality: z.number().int().min(0).max(5),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawId = (await params).id;
    const idValidation = objectIdSchema.safeParse(rawId);
    if (!idValidation.success) {
      return NextResponse.json({ error: 'Invalid flashcard ID format' }, { status: 400 });
    }
    const flashcardId = idValidation.data;

    const parseResult = await safeJsonParse(request);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const schemaResult = reviewSchema.safeParse(parseResult.data);
    if (!schemaResult.success) {
      return NextResponse.json(
        { error: 'Invalid input: quality must be an integer between 0 and 5', details: schemaResult.error.format() },
        { status: 400 }
      );
    }
    const { quality } = schemaResult.data;

    const flashcard = await prisma.flashcard.findUnique({
      where: { id: flashcardId }
    });

    if (!flashcard || flashcard.userId !== session.user.id) {
      return NextResponse.json({ error: 'Flashcard not found' }, { status: 404 });
    }

    const { interval, repetition, easeFactor, nextReviewAt } = calculateSM2(
      quality, 
      {
        interval: flashcard.interval,
        repetition: flashcard.repetition,
        easeFactor: flashcard.easeFactor
      },
      flashcard.nextReviewAt // We can use nextReviewAt as an approximation or add lastReviewedAt field
    );

    const updated = await prisma.flashcard.update({
      where: { id: flashcardId },
      data: {
        interval,
        repetition,
        easeFactor,
        nextReviewAt
      }
    });

    return NextResponse.json({ success: true, flashcard: updated });
  } catch (error) {
    console.error('Error reviewing flashcard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
