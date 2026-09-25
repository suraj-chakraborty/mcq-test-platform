import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { defaultJobRunner } from '@/app/lib/pipeline/runner';
import { extractIdempotencyKey } from '@/app/lib/idempotency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, domainTopic = 'General', numQuestions = 10, contextPDFs = [], pyqPDFs = [] } = body;

    if (!title || contextPDFs.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: title and at least one context PDF are required.' },
        { status: 400 }
      );
    }

    const idempotencyKey = extractIdempotencyKey(req, undefined, {
      userId: session.user.id,
      title,
      topic: domainTopic,
      numQuestions,
      files: contextPDFs.map((f: any) => f.name || 'document.pdf'),
    });

    // Enqueue in background runner (< 150ms)
    const result = await defaultJobRunner.enqueue({
      userId: session.user.id,
      idempotencyKey,
      title,
      topic: domainTopic,
      numQuestions: parseInt(String(numQuestions), 10) || 10,
      contextPDFs,
      pyqPDFs,
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      status: result.status,
      message: 'Job enqueued successfully. Monitor progress via /api/jobs/[id]',
    });
  } catch (error: any) {
    console.error('[API_JOBS_CREATE] Error enqueuing job:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to enqueue test generation job' },
      { status: 500 }
    );
  }
}
