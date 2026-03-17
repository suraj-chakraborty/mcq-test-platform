import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { calculateSM2 } from '@/app/lib/srs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quality } = await request.json(); // Rating 0-5
    const flashcardId = (await params).id;

    const flashcard = await prisma.flashcard.findUnique({
      where: { id: flashcardId }
    });

    if (!flashcard || flashcard.userId !== session.user.id) {
      return NextResponse.json({ error: 'Flashcard not found' }, { status: 404 });
    }

    const { interval, repetition, easeFactor, nextReviewAt } = calculateSM2(quality, {
      interval: flashcard.interval,
      repetition: flashcard.repetition,
      easeFactor: flashcard.easeFactor
    });

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
