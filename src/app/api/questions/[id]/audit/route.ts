import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { objectIdSchema, safeJsonParse } from '@/app/lib/validations/common';
import { z } from 'zod';

const auditReportSchema = z
  .object({
    reason: z.string().trim().min(1, 'Reason is required').max(500, 'Reason too long'),
    details: z.string().trim().max(2000, 'Details too long').optional(),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawId = (await params).id;
    const idValidation = objectIdSchema.safeParse(rawId);
    if (!idValidation.success) {
      return NextResponse.json({ error: 'Invalid question ID format' }, { status: 400 });
    }
    const questionId = idValidation.data;

    const parseResult = await safeJsonParse(request);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const bodyValidation = auditReportSchema.safeParse(parseResult.data);
    if (!bodyValidation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: bodyValidation.error.format() },
        { status: 400 }
      );
    }
    const { reason, details } = bodyValidation.data;

    // Verify question actually exists
    if (prisma.question?.findUnique) {
      const question = await prisma.question.findUnique({
        where: { id: questionId },
      });

      if (!question) {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 });
      }
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
