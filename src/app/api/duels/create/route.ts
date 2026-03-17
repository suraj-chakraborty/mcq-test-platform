import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

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

    // Generate a unique 6-character room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const duelRoom = await prisma.duelRoom.create({
      data: {
        roomCode,
        testId,
        hostId: session.user.id,
        status: 'WAITING',
      },
    });

    return NextResponse.json({
      success: true,
      room: duelRoom,
    });

  } catch (error) {
    console.error('Error creating duel room:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}
