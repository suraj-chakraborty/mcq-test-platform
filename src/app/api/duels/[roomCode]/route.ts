import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { progress } = await request.json(); // 0-100
    const roomCode = (await params).roomCode;

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

    const updateData: any = {};
    if (isHost) updateData.hostProgress = progress;
    else updateData.guestProgress = progress;

    // Check if both finished
    if (progress === 100) {
       // Check other participant
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
    const roomCode = (await params).roomCode;
    const duelRoom = await prisma.duelRoom.findUnique({
      where: { roomCode },
      include: {
        host: { select: { id: true, name: true } },
        guest: { select: { id: true, name: true } },
        test: { select: { title: true, questions: true } }
      }
    });

    if (!duelRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      room: duelRoom,
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
