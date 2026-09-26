import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { safeJsonParse } from '@/app/lib/validations/common';
import crypto from 'crypto';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const mobileCreateDuelSchema = z.object({
  testId: z.string().optional(),
});

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

    const validation = mobileCreateDuelSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      );
    }

    let targetTestId = validation.data.testId;

    if (targetTestId) {
      const test = await prisma.test.findUnique({
        where: { id: targetTestId },
        include: { _count: { select: { questions: true } } },
      });

      if (!test) {
        return NextResponse.json({ error: 'Test not found' }, { status: 404 });
      }

      if (test._count.questions === 0) {
        return NextResponse.json(
          { error: 'The selected assessment contains no questions for battle' },
          { status: 400 }
        );
      }
    } else {
      // Pick the most recent test with questions as battle ground
      const fallbackTest = await prisma.test.findFirst({
        where: {
          questions: { some: {} },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!fallbackTest) {
        return NextResponse.json(
          { error: 'No assessment questions available to duel on. Please synthesize a test first.' },
          { status: 400 }
        );
      }
      targetTestId = fallbackTest.id;
    }

    // Generate unique 6-character room code
    const roomCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const duelRoom = await prisma.duelRoom.create({
      data: {
        roomCode,
        testId: targetTestId,
        hostId: user.id,
        status: 'WAITING',
      },
      include: {
        test: {
          select: {
            id: true,
            title: true,
            duration: true,
            _count: { select: { questions: true } },
          },
        },
        host: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      room: {
        id: duelRoom.id,
        roomCode: duelRoom.roomCode,
        status: duelRoom.status,
        testId: duelRoom.testId,
        testTitle: duelRoom.test.title,
        questionCount: duelRoom.test._count.questions,
        hostId: duelRoom.hostId,
        hostName: duelRoom.host.name || 'Scholar',
        hostProgress: duelRoom.hostProgress,
        guestProgress: duelRoom.guestProgress,
      },
    });
  } catch (error) {
    console.error('Error creating mobile duel room:', error);
    return NextResponse.json({ error: 'Failed to create battle arena' }, { status: 500 });
  }
}
