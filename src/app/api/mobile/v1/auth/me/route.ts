import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function GET(req: Request) {
  try {
    // 1. Try mobile Bearer token
    let user = await getMobileAuthUser(req);

    // 2. Fall back to NextAuth session if available
    if (!user) {
      const session = await getServerSession(authOptions);
      if (session?.user?.email) {
        user = await prisma.user.findUnique({
          where: { email: session.user.email },
        });
      }
    }

    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized. Please provide a valid Bearer token.', error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user aggregates
    const [attemptsCount, flashcardsCount, achievementsCount] = await Promise.all([
      (prisma as any).testAttempt.count({ where: { userId: user.id } }),
      (prisma as any).flashcard.count({ where: { userId: user.id } }),
      (prisma as any).achievement.count({ where: { userId: user.id } }),
    ]);

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          phone: user.phone,
          targetExam: user.targetExam,
          institution: user.institution,
          academicLevel: user.academicLevel,
          bio: user.bio,
          isVerified: user.isVerified,
          xp: user.xp,
          level: user.level,
          streak: user.streak,
          lastActivityAt: user.lastActivityAt,
          stats: {
            testsCompleted: attemptsCount,
            flashcardsCount,
            achievementsCount,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Mobile auth me error:', error);
    return NextResponse.json(
      { message: 'An error occurred fetching user profile', error: 'Internal server error' },
      { status: 500 }
    );
  }
}
