import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { objectIdSchema, safeJsonParse } from '@/app/lib/validations/common';
import crypto from 'crypto';
import { z } from 'zod';

const createDuelSchema = z
  .object({
    testId: objectIdSchema,
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

    const schemaResult = createDuelSchema.safeParse(parseResult.data);
    if (!schemaResult.success) {
      return NextResponse.json(
        { error: 'Valid test ID is required', details: schemaResult.error.format() },
        { status: 400 }
      );
    }
    const { testId } = schemaResult.data;

    // Verify test exists if test repository is available
    if (prisma.test?.findUnique) {
      const test = await prisma.test.findUnique({
        where: { id: testId },
      });

      if (!test) {
        return NextResponse.json({ error: 'Test not found' }, { status: 404 });
      }
    }


    // Generate a unique 6-character room code using cryptographic random bytes
    const roomCode = crypto.randomBytes(3).toString('hex').toUpperCase();

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
