import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { createMobileTokens } from '@/app/lib/mobileAuth';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized. No active web session found.' },
        { status: 401 }
      );
    }

    const email = session.user.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'User account not found' },
        { status: 404 }
      );
    }

    // Restore if marked for deletion
    const userAny = user as any;
    if (userAny.isMarkedForDeletion) {
      await (prisma.user as any).update({
        where: { id: user.id },
        data: { isMarkedForDeletion: false, deletionRequestedAt: null },
      });
    }

    const tokens = await createMobileTokens(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      'Mobile App (Google Auth Bridge)'
    );

    return NextResponse.json(
      {
        message: 'Google authentication bridge successful',
        ...tokens,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          xp: user.xp,
          level: user.level,
          streak: user.streak,
          targetExam: user.targetExam,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Google mobile token bridge error:', error);
    return NextResponse.json(
      { message: 'Failed to generate mobile tokens' },
      { status: 500 }
    );
  }
}
