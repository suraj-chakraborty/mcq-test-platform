import { POST as createJobPOST } from '../api/jobs/create/route';
import { GET as getJobGET, DELETE as deleteJobDELETE } from '../api/jobs/[id]/route';
import { defaultJobRunner } from '../lib/pipeline/runner';
import { getServerSession } from 'next-auth';

jest.mock('next-auth');

describe('API Route: /api/jobs/create & /api/jobs/[id]', () => {
  const fakeUserId = '507f1f77bcf86cd799439011';
  const fakeJobId = '607f1f77bcf86cd799439022';

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: fakeUserId, email: 'test@example.com' },
    });
  });

  describe('POST /api/jobs/create', () => {
    it('returns 401 if user is not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);
      const req = new Request('http://localhost:3000/api/jobs/create', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test', contextPDFs: [{ name: 'doc.pdf' }] }),
      });

      const res = await createJobPOST(req);
      expect(res.status).toBe(401);
    });

    it('returns 400 if title or contextPDFs are missing', async () => {
      const req = new Request('http://localhost:3000/api/jobs/create', {
        method: 'POST',
        body: JSON.stringify({ title: '' }),
      });

      const res = await createJobPOST(req);
      expect(res.status).toBe(400);
    });

    it('enqueues job and returns jobId immediately (< 200ms)', async () => {
      const enqueueSpy = jest.spyOn(defaultJobRunner, 'enqueue').mockResolvedValue({
        jobId: fakeJobId,
        status: 'QUEUED',
      });

      const req = new Request('http://localhost:3000/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Cellular Respiration',
          domainTopic: 'Biology',
          numQuestions: 15,
          contextPDFs: [{ name: 'cell.pdf', url: 'https://cloudinary.com/cell.pdf' }],
        }),
      });

      const start = Date.now();
      const res = await createJobPOST(req);
      const duration = Date.now() - start;
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(200);
      expect(data.success).toBe(true);
      expect(data.jobId).toBe(fakeJobId);
      expect(data.status).toBe('QUEUED');
      expect(enqueueSpy).toHaveBeenCalled();
    });
  });

  describe('GET /api/jobs/[id]', () => {
    it('returns 404 if job does not exist', async () => {
      jest.spyOn(defaultJobRunner, 'getJob').mockResolvedValue(null);

      const req = new Request(`http://localhost:3000/api/jobs/${fakeJobId}`);
      const res = await getJobGET(req, { params: Promise.resolve({ id: fakeJobId }) });

      expect(res.status).toBe(404);
    });

    it('returns current status, progress, and stage', async () => {
      jest.spyOn(defaultJobRunner, 'getJob').mockResolvedValue({
        id: fakeJobId,
        userId: fakeUserId,
        status: 'EXTRACTING',
        progress: 35,
        currentStep: 2,
        totalSteps: 6,
        stage: 'Extracting text layer and analyzing document structure...',
        error: null,
        errorCode: null,
        testId: null,
        metadata: { title: 'Cellular Respiration' },
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
      });

      const req = new Request(`http://localhost:3000/api/jobs/${fakeJobId}`);
      const res = await getJobGET(req, { params: Promise.resolve({ id: fakeJobId }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.job.status).toBe('EXTRACTING');
      expect(data.job.progress).toBe(35);
      expect(data.job.stage).toContain('Extracting text layer');
    });
  });

  describe('DELETE /api/jobs/[id]', () => {
    it('cancels an in-flight job', async () => {
      jest.spyOn(defaultJobRunner, 'cancelJob').mockResolvedValue(true);

      const req = new Request(`http://localhost:3000/api/jobs/${fakeJobId}`, { method: 'DELETE' });
      const res = await deleteJobDELETE(req, { params: Promise.resolve({ id: fakeJobId }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('cancelled successfully');
    });
  });
});
