import { NextResponse } from 'next/server';
import { resolveAuthUser } from '@/app/lib/mobileAuth';
import { prisma } from '@/app/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await resolveAuthUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const questionId = (await params).id;
    const body = await request.json();
    const reason = String(body.reason || body.issueType || 'Content Issue').trim();
    const details = body.details || body.comment ? String(body.details || body.comment).trim() : undefined;

    if (!reason) {
      return NextResponse.json({ error: 'Audit reason is required' }, { status: 400 });
    }

    const audit = await prisma.questionAudit.create({
      data: {
        questionId,
        userId: user.id,
        reason,
        details,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Question report submitted for academic audit',
      audit,
    });
  } catch (error) {
    console.error('Error submitting mobile question audit:', error);
    return NextResponse.json(
      { error: 'Failed to submit question audit' },
      { status: 500 }
    );
  }
}

