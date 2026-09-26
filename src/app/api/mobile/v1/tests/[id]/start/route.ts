import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    const resolvedParams = await Promise.resolve(params);
    const testId = resolvedParams.id;

    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
    }

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        questions: {
          select: {
            id: true,
            question: true,
            options: true,
            difficulty: true,
            // EXAM INTEGRITY: correctAnswer, explanation, proofQuote are intentionally omitted!
          },
        },
      },
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    if (test.questions.length === 0) {
      return NextResponse.json({ error: 'This test does not contain any questions.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        duration: test.duration || 20, // default 20 minutes
        questionCount: test.questions.length,
        questions: test.questions,
      },
    });
  } catch (error) {
    console.error('Error starting test on mobile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
