import { TextEncoder } from 'util';
import { ReadableStream as WebReadableStream } from 'stream/web';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { defaultJobRunner } from '@/app/lib/pipeline/runner';
import { JOB_STATUSES } from '@/app/lib/pipeline/types';

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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resolvedParams = await Promise.resolve(params);
    const jobId = resolvedParams.id;

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const initialJob = await defaultJobRunner.getJob(jobId, user.id);
    if (!initialJob) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    let isClosed = false;
    const StreamClass = typeof ReadableStream !== 'undefined' ? ReadableStream : (WebReadableStream as any);

    const stream = new StreamClass({
      async start(controller: any) {
        // Send initial connection comment
        controller.enqueue(encoder.encode(': stream connected\n\n'));

        // Push initial state
        const initialPayload = JSON.stringify({
          id: initialJob.id,
          status: initialJob.status,
          progress: initialJob.progress,
          currentStep: initialJob.currentStep,
          totalSteps: initialJob.totalSteps,
          stage: initialJob.stage,
          error: initialJob.error,
          errorCode: initialJob.errorCode,
          testId: initialJob.testId,
        });
        controller.enqueue(encoder.encode(`data: ${initialPayload}\n\n`));

        if (
          initialJob.status === JOB_STATUSES.COMPLETED ||
          initialJob.status === JOB_STATUSES.FAILED ||
          initialJob.status === JOB_STATUSES.CANCELLED
        ) {
          isClosed = true;
          controller.close();
          return;
        }

        let lastProgress = initialJob.progress;
        let lastStatus = initialJob.status;
        let lastStage = initialJob.stage;

        const interval = setInterval(async () => {
          if (isClosed || req.signal.aborted) {
            clearInterval(interval);
            if (!isClosed) {
              isClosed = true;
              try {
                controller.close();
              } catch (_) {}
            }
            return;
          }

          try {
            const currentJob = await defaultJobRunner.getJob(jobId, user.id);
            if (!currentJob) {
              clearInterval(interval);
              isClosed = true;
              controller.close();
              return;
            }

            // Emit if there is any progress or status change
            if (
              currentJob.progress !== lastProgress ||
              currentJob.status !== lastStatus ||
              currentJob.stage !== lastStage
            ) {
              lastProgress = currentJob.progress;
              lastStatus = currentJob.status;
              lastStage = currentJob.stage;

              const payload = JSON.stringify({
                id: currentJob.id,
                status: currentJob.status,
                progress: currentJob.progress,
                currentStep: currentJob.currentStep,
                totalSteps: currentJob.totalSteps,
                stage: currentJob.stage,
                error: currentJob.error,
                errorCode: currentJob.errorCode,
                testId: currentJob.testId,
              });

              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));

              if (
                currentJob.status === JOB_STATUSES.COMPLETED ||
                currentJob.status === JOB_STATUSES.FAILED ||
                currentJob.status === JOB_STATUSES.CANCELLED
              ) {
                clearInterval(interval);
                isClosed = true;
                controller.close();
              }
            } else {
              // Send keepalive comment every 15s to keep mobile connection alive
              controller.enqueue(encoder.encode(': keepalive\n\n'));
            }
          } catch (err) {
            console.error('SSE polling error in stream:', err);
            clearInterval(interval);
            if (!isClosed) {
              isClosed = true;
              try {
                controller.close();
              } catch (_) {}
            }
          }
        }, 1000);

        req.signal.addEventListener('abort', () => {
          clearInterval(interval);
          if (!isClosed) {
            isClosed = true;
            try {
              controller.close();
            } catch (_) {}
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('Error initiating SSE stream for job:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
