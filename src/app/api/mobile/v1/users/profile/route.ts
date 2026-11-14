import { NextResponse } from 'next/server';
import { resolveAuthUser } from '@/app/lib/mobileAuth';
import { prisma } from '@/app/lib/prisma';
import { calculateLevel } from '@/app/lib/gamification';

export async function GET(request: Request) {
  try {
    const authUser = await resolveAuthUser(request);
    if (!authUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
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
          take: 20,
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

    const totalAttempts = user._count?.attempts || 0;
    const averageScore = totalAttempts > 0 && user.attempts.length > 0
      ? Math.round(
          user.attempts.reduce((acc, curr) => acc + (curr.score || 0), 0) /
          user.attempts.length
        )
      : 0;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        targetExam: user.targetExam,
        institution: user.institution,
        academicLevel: user.academicLevel,
        bio: user.bio,
        image: user.image,
        xp: user.xp,
        level: user.level,
        streak: user.streak,
        isVerified: user.isVerified,
        isMarkedForDeletion: user.isMarkedForDeletion,
        deletionRequestedAt: user.deletionRequestedAt,
        lastActivityAt: user.lastActivityAt,
        xpInCurrentLevel,
        xpNeededForNextLevel,
      },
      stats: {
        testsCreated: user._count?.tests || 0,
        testsAttempted: totalAttempts,
        averageScore,
        flashcardsMastered: user._count?.flashcards || 0,
        duelsHosted: user._count?.hostedDuels || 0,
        descriptiveSubmissions: user._count?.descriptiveTests || 0,
      },
      recentAttempts: user.attempts.map((att) => ({
        id: att.id,
        testId: att.testId,
        testTitle: att.test?.title || 'Assessment',
        score: att.score,
        completed: att.completed,
        xpEarned: att.xpEarned,
        createdAt: att.createdAt,
        completedAt: att.completedAt,
      })),
      achievements: user.achievements,
    });
  } catch (error) {
    console.error('Error fetching mobile user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
