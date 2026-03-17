import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { roomCode } = await request.json();
    if (!roomCode) {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
    }

    const duelRoom = await prisma.duelRoom.findUnique({
      where: { roomCode },
    });

    if (!duelRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (duelRoom.status !== 'WAITING') {
      return NextResponse.json({ error: 'Room is already full or battle started' }, { status: 400 });
    }

    if (duelRoom.hostId === session.user.id) {
      return NextResponse.json({ error: 'You are already the host' }, { status: 400 });
    }

    const updatedRoom = await prisma.duelRoom.update({
      where: { id: duelRoom.id },
      data: {
        guestId: session.user.id,
        status: 'ACTIVE', // Automatically start when guest joins for now
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
