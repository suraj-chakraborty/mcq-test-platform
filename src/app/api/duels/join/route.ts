import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { safeJsonParse } from '@/app/lib/validations/common';
import { z } from 'zod';

const joinDuelSchema = z
  .object({
    roomCode: z.string().trim().min(4, 'Room code must be at least 4 characters').max(12).regex(/^[a-zA-Z0-9]+$/, 'Invalid room code format'),
  })
  .strict();

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

    const schemaResult = joinDuelSchema.safeParse(parseResult.data);
    if (!schemaResult.success) {
      return NextResponse.json(
        { error: 'Invalid room code', details: schemaResult.error.format() },
        { status: 400 }
      );
    }
    const cleanRoomCode = schemaResult.data.roomCode.toUpperCase();

    const duelRoom = await prisma.duelRoom.findUnique({
      where: { roomCode: cleanRoomCode },
    });

    if (!duelRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (duelRoom.hostId === session.user.id) {
      return NextResponse.json({ error: 'You are already the host' }, { status: 400 });
    }

    if (duelRoom.status !== 'WAITING' || duelRoom.guestId) {
      return NextResponse.json({ error: 'Room is already full or battle started' }, { status: 409 });
    }

    const updatedRoom = await prisma.duelRoom.update({
      where: { id: duelRoom.id },
      data: {
        guestId: session.user.id,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      room: updatedRoom,
    });


  } catch (error) {
    console.error('Error joining duel room:', error);
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }
}
