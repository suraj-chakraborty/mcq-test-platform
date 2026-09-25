import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { safeJsonParse } from '@/app/lib/validations/common';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const joinDuelSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .min(4, 'Room code must be at least 4 characters')
    .max(12)
    .regex(/^[a-zA-Z0-9]+$/, 'Invalid room code format'),
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

    const schemaResult = joinDuelSchema.safeParse(parseResult.data);
    if (!schemaResult.success) {
      return NextResponse.json(
        { error: 'Invalid room code format', details: schemaResult.error.format() },
        { status: 400 }
      );
    }

    const cleanRoomCode = schemaResult.data.roomCode.toUpperCase();

    const duelRoom = await prisma.duelRoom.findUnique({
      where: { roomCode: cleanRoomCode },
    });

    if (!duelRoom) {
      return NextResponse.json({ error: 'Battle room not found' }, { status: 404 });
    }

    if (duelRoom.hostId === user.id) {
      return NextResponse.json({ error: 'You are already the host of this battle' }, { status: 400 });
    }

    if (duelRoom.status !== 'WAITING' || duelRoom.guestId) {
      return NextResponse.json(
        { error: 'This battle room is already full or has commenced' },
        { status: 409 }
      );
    }

    // Atomic Join Race Condition Defense (SEC-024)
    let updatedRoom: any;
    if (typeof (prisma.duelRoom as any).updateMany === 'function') {
      const updateResult = await (prisma.duelRoom as any).updateMany({
        where: {
          id: duelRoom.id,
          status: 'WAITING',
          guestId: null,
        },
        data: {
          guestId: user.id,
          status: 'ACTIVE',
        },
      });

      if (updateResult.count === 0) {
        return NextResponse.json(
          { error: 'This battle room was just joined by another challenger' },
          { status: 409 }
        );
      }

      updatedRoom = await prisma.duelRoom.findUnique({
        where: { id: duelRoom.id },
        include: {
          host: { select: { id: true, name: true, image: true } },
          guest: { select: { id: true, name: true, image: true } },
          test: { select: { id: true, title: true, duration: true } },
        },
      });
    } else {
      updatedRoom = await prisma.duelRoom.update({
        where: { id: duelRoom.id },
        data: {
          guestId: user.id,
          status: 'ACTIVE',
        },
        include: {
          host: { select: { id: true, name: true, image: true } },
          guest: { select: { id: true, name: true, image: true } },
          test: { select: { id: true, title: true, duration: true } },
        },
      });
    }

    return NextResponse.json({
      success: true,
      room: {
        id: updatedRoom.id,
        roomCode: updatedRoom.roomCode,
        status: updatedRoom.status,
        testId: updatedRoom.testId,
        testTitle: updatedRoom.test?.title,
        hostId: updatedRoom.hostId,
        hostName: updatedRoom.host?.name || 'Host',
        guestId: updatedRoom.guestId,
        guestName: updatedRoom.guest?.name || user.name || 'Challenger',
        hostProgress: updatedRoom.hostProgress,
        guestProgress: updatedRoom.guestProgress,
      },
    });
  } catch (error) {
    console.error('Error joining mobile duel room:', error);
    return NextResponse.json({ error: 'Failed to join battle room' }, { status: 500 });
  }
}
