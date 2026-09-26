import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { safeJsonParse } from '@/app/lib/validations/common';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
  score: z.number().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomCode: string }> }
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
    const roomCode = resolvedParams.roomCode?.trim().toUpperCase();

    if (!roomCode) {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
    }

    const duelRoom = await prisma.duelRoom.findUnique({
      where: { roomCode },
      include: {
        host: {
          select: { id: true, name: true, image: true },
        },
        guest: {
          select: { id: true, name: true, image: true },
        },
        test: {
          select: {
            id: true,
            title: true,
            duration: true,
            questions: {
              select: {
                id: true,
                question: true,
                options: true,
                difficulty: true,
                // EXAM INTEGRITY: correctAnswer, explanation, proofQuote are strictly omitted!
              },
            },
          },
        },
      },
    });

    if (!duelRoom) {
      return NextResponse.json({ error: 'Battle room not found' }, { status: 404 });
    }

    // Only host or guest can participate/poll the room
    const isHost = duelRoom.hostId === user.id;
    const isGuest = duelRoom.guestId === user.id;

    if (!isHost && !isGuest) {
      return NextResponse.json(
        { error: 'Forbidden: You are not a participant in this duel' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      room: {
        id: duelRoom.id,
        roomCode: duelRoom.roomCode,
        status: duelRoom.status,
        hostId: duelRoom.hostId,
        hostName: duelRoom.host?.name || 'Host',
        hostProgress: duelRoom.hostProgress,
        guestId: duelRoom.guestId,
        guestName: duelRoom.guest?.name || 'Challenger',
        guestProgress: duelRoom.guestProgress,
        isHost,
        test: {
          id: duelRoom.test.id,
          title: duelRoom.test.title,
          duration: duelRoom.test.duration || 10,
          questionCount: duelRoom.test.questions.length,
          questions: duelRoom.test.questions,
        },
      },
    });
  } catch (error) {
    console.error('Error polling mobile duel state:', error);
    return NextResponse.json({ error: 'Failed to retrieve duel state' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomCode: string }> }
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
    const roomCode = resolvedParams.roomCode?.trim().toUpperCase();

    if (!roomCode) {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
    }

    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = updateProgressSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { progress } = validation.data;

    const duelRoom = await prisma.duelRoom.findUnique({
      where: { roomCode },
    });

    if (!duelRoom) {
      return NextResponse.json({ error: 'Battle room not found' }, { status: 404 });
    }

    const isHost = duelRoom.hostId === user.id;
    const isGuest = duelRoom.guestId === user.id;

    if (!isHost && !isGuest) {
      return NextResponse.json(
        { error: 'Forbidden: You are not a participant in this duel' },
        { status: 403 }
      );
    }

    // Monotonically non-decreasing progress guard: progress can never regress
    const currentProgress = isHost ? duelRoom.hostProgress : duelRoom.guestProgress;
    const validatedProgress = Math.max(currentProgress, progress);

    const updateData: any = {};
    if (isHost) updateData.hostProgress = validatedProgress;
    else updateData.guestProgress = validatedProgress;

    // Check if duel completes
    let isTransitioningToFinished = false;
    if (validatedProgress === 100) {
      const otherProgress = isHost ? duelRoom.guestProgress : duelRoom.hostProgress;
      if (otherProgress === 100 || duelRoom.status === 'FINISHED') {
        updateData.status = 'FINISHED';
        isTransitioningToFinished = duelRoom.status !== 'FINISHED';
      }
    }

    const updatedRoom = await prisma.duelRoom.update({
      where: { id: duelRoom.id },
      data: updateData,
      include: {
        host: { select: { id: true, name: true } },
        guest: { select: { id: true, name: true } },
      },
    });

    // Gamification XP on battle completion (+50 XP winner, +20 XP runner-up)
    if (isTransitioningToFinished) {
      try {
        await Promise.all([
          (prisma.user as any).update({
            where: { id: updatedRoom.hostId },
            data: { xp: { increment: 50 } },
          }),
          updatedRoom.guestId
            ? (prisma.user as any).update({
                where: { id: updatedRoom.guestId },
                data: { xp: { increment: 20 } },
              })
            : Promise.resolve(),
        ]);
      } catch (xpErr) {
        console.warn('Non-fatal duel XP update error:', xpErr);
      }
    }

    return NextResponse.json({
      success: true,
      room: {
        id: updatedRoom.id,
        roomCode: updatedRoom.roomCode,
        status: updatedRoom.status,
        hostProgress: updatedRoom.hostProgress,
        guestProgress: updatedRoom.guestProgress,
      },
    });
  } catch (error) {
    console.error('Error updating mobile duel progress:', error);
    return NextResponse.json({ error: 'Failed to update battle progress' }, { status: 500 });
  }
}
