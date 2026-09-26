import { NextResponse } from 'next/server';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { defaultJobRunner } from '@/app/lib/pipeline/runner';
import { extractIdempotencyKey } from '@/app/lib/idempotency';
import { safeJsonParse } from '@/app/lib/validations/common';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pdfItemSchema = z.object({
  name: z.string().min(1),
  url: z.string().url('Invalid PDF URL'),
  size: z.number().optional(),
});

const mobileJobCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  domainTopic: z.string().optional().default('General'),
  numQuestions: z.coerce.number().int().min(3).max(50).optional().default(10),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  mode: z.enum(['context', 'pyq']).optional().default('context'),
  contextPDFs: z.array(pdfItemSchema).min(1, 'At least one context PDF is required'),
  pyqPDFs: z.array(pdfItemSchema).optional().default([]),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: Request) {
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

    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = mobileJobCreateSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const {
      title,
      domainTopic,
      numQuestions,
      difficulty,
      mode,
      contextPDFs,
      pyqPDFs,
      idempotencyKey: clientKey,
    } = validation.data;

    const idempotencyKey = extractIdempotencyKey(req, clientKey, {
      userId: user.id,
      title,
      topic: domainTopic,
      numQuestions,
      files: contextPDFs.map((f) => f.name),
    });

    const result = await defaultJobRunner.enqueue({
      userId: user.id,
      idempotencyKey,
      title,
      topic: domainTopic,
      numQuestions,
      contextPDFs,
      pyqPDFs,
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      status: result.status,
      message: 'Job enqueued successfully. Monitor progress via SSE or polling.',
    });
  } catch (error: any) {
    console.error('Error creating mobile synthesis job:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to enqueue test generation job' },
      { status: 500 }
    );
  }
}
