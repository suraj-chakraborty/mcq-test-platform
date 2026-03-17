import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { calculateLevel } from '@/app/lib/gamification';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        xp: true,
        level: true,
        streak: true,
        achievements: {
          orderBy: { unlockedAt: 'desc' }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { xpInCurrentLevel, xpNeededForNextLevel } = calculateLevel(user.xp);

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        xpInCurrentLevel,
        xpNeededForNextLevel,
        totalXp: user.xp
      }
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
