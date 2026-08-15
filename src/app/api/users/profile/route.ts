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
      include: {
        _count: {
          select: {
            tests: true,
            attempts: true,
            flashcards: true,
            descriptiveTests: true,
            hostedDuels: true,
          },
        },
        attempts: {
          take: 6,
          orderBy: { createdAt: 'desc' },
          include: {
            test: {
              select: {
                title: true,
              },
            },
          },
        },
        achievements: {
          orderBy: { unlockedAt: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { xpInCurrentLevel, xpNeededForNextLevel } = calculateLevel(user.xp);

    // Calculate aggregated metrics
    const totalAttempts = user._count?.attempts || 0;
    const avgScore =
      user.attempts && user.attempts.length > 0
        ? Math.round(
            user.attempts.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0) /
              user.attempts.length
          )
        : 0;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        xp: user.xp,
        level: user.level,
        streak: user.streak,
        isVerified: user.isVerified,
        lastActivityAt: user.lastActivityAt,
        _count: user._count,
        attempts: user.attempts,
        achievements: user.achievements,
        xpInCurrentLevel,
        xpNeededForNextLevel,
        totalXp: user.xp,
        totalAttempts,
        avgScore,
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
