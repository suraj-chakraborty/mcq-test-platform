import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reason, details } = await request.json();
    const questionId = (await params).id;

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    const audit = await prisma.questionAudit.create({
      data: {
        questionId,
        userId: session.user.id,
        reason,
        details,
        status: 'PENDING'
      }
    });

    return NextResponse.json({ success: true, audit });
  } catch (error) {
    console.error('Error reporting question:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
