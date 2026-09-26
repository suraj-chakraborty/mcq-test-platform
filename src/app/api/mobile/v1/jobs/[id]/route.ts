import { NextResponse } from 'next/server';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { defaultJobRunner } from '@/app/lib/pipeline/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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
    const jobId = resolvedParams.id;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const job = await defaultJobRunner.getJob(jobId, user.id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        totalSteps: job.totalSteps,
        stage: job.stage,
        error: job.error,
        errorCode: job.errorCode,
        testId: job.testId,
        metadata: job.metadata,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      },
    });
  } catch (error: any) {
    if (error?.statusCode === 403) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching mobile job status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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
    const jobId = resolvedParams.id;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const cancelled = await defaultJobRunner.cancelJob(jobId, user.id);
    if (!cancelled) {
      return NextResponse.json(
        { error: 'Job could not be cancelled (already finished or not found)' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
    });
  } catch (error: any) {
    console.error('Error cancelling mobile job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
