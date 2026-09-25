import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { safeJsonParse } from '@/app/lib/validations/common';
import { z } from 'zod';

const updateProgressSchema = z
  .object({
    progress: z.number().int().min(0).max(100),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parseResult = await safeJsonParse(request);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const schemaResult = updateProgressSchema.safeParse(parseResult.data);
    if (!schemaResult.success) {
      return NextResponse.json(
        { error: 'Invalid input: progress must be an integer between 0 and 100', details: schemaResult.error.format() },
        { status: 400 }
      );
    }
    const { progress } = schemaResult.data;

    const rawCode = (await params).roomCode;
    const roomCode = rawCode?.trim().toUpperCase();

    const duelRoom = await prisma.duelRoom.findUnique({
      where: { roomCode },
    });

    if (!duelRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const isHost = duelRoom.hostId === session.user.id;
    const isGuest = duelRoom.guestId === session.user.id;

    if (!isHost && !isGuest) {
      return NextResponse.json({ error: 'You are not in this duel' }, { status: 403 });
    }

    // Monotonically non-decreasing progress guard: progress can never regress
    const currentProgress = isHost ? (duelRoom.hostProgress || 0) : (duelRoom.guestProgress || 0);
    const validatedProgress = Math.max(currentProgress, progress);

    const updateData: any = {};
    if (isHost) updateData.hostProgress = validatedProgress;
    else updateData.guestProgress = validatedProgress;

    // Check if both participants finished
    if (validatedProgress === 100) {
      const otherProgress = isHost ? duelRoom.guestProgress : duelRoom.hostProgress;
      if (otherProgress === 100) {
        updateData.status = 'FINISHED';
      }
    }

    const updatedRoom = await prisma.duelRoom.update({
      where: { id: duelRoom.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      room: updatedRoom,
    });

  } catch (error) {
    console.error('Error updating duel progress:', error);
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawCode = (await params).roomCode;
    const roomCode = rawCode?.trim().toUpperCase();

    const duelRoom = await prisma.duelRoom.findUnique({
      where: { roomCode },
      include: {
        host: { select: { id: true, name: true } },
        guest: { select: { id: true, name: true } },
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
              }
            }
          }
        }
      }
    });

    if (!duelRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Only host, guest, or authenticated participants can view duel state
    if (duelRoom.hostId !== session.user.id && duelRoom.guestId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden: You are not a participant in this duel' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      room: duelRoom,
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
