import { POST as mobileCloudinarySignPOST } from '../api/mobile/v1/cloudinary/sign/route';
import { POST as mobileJobCreatePOST } from '../api/mobile/v1/jobs/create/route';
import { GET as mobileJobGetGET, DELETE as mobileJobDeleteDELETE } from '../api/mobile/v1/jobs/[id]/route';
import { GET as mobileJobStreamGET } from '../api/mobile/v1/jobs/[id]/stream/route';
import { prisma } from '@/app/lib/prisma';
import { encode } from 'next-auth/jwt';
import { defaultJobRunner } from '@/app/lib/pipeline/runner';

jest.mock('@/app/lib/pipeline/runner', () => ({
  defaultJobRunner: {
    enqueue: jest.fn(),
    getJob: jest.fn(),
    cancelJob: jest.fn(),
  },
}));

jest.mock('cloudinary', () => ({
  v2: {
    utils: {
      api_sign_request: jest.fn().mockReturnValue('mock_cloudinary_signature_123'),
    },
  },
}));

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Phase 3: Mobile v1 Cloudinary Upload & Job Pipeline Endpoints', () => {
  const TEST_SECRET = 'test_secret_for_mobile_auth_32_characters_long!';
  let validBearerToken: string;

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
    process.env.CLOUDINARY_API_KEY = 'test_key';
    process.env.CLOUDINARY_API_SECRET = 'test_secret';

    validBearerToken = await encode({
      token: {
        id: 'u-scholar-123',
        sub: 'u-scholar-123',
        name: 'Mobile Scholar',
        email: 'scholar@example.com',
      },
      secret: TEST_SECRET,
      maxAge: 900,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u-scholar-123',
      name: 'Mobile Scholar',
      email: 'scholar@example.com',
      isVerified: true,
    });
  });

  describe('POST /api/mobile/v1/cloudinary/sign', () => {
    it('returns 401 when no auth token provided', async () => {
      const req = new Request('http://localhost:3000/api/mobile/v1/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'pdfs' }),
      });

      const res = await mobileCloudinarySignPOST(req);
      expect(res.status).toBe(401);
    });

    it('rejects invalid folder names with 400', async () => {
      const req = new Request('http://localhost:3000/api/mobile/v1/cloudinary/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validBearerToken}`,
        },
        body: JSON.stringify({ folder: 'unauthorized_folder' }),
      });

      const res = await mobileCloudinarySignPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid signing parameters');
    });

    it('rejects files exceeding max size (50MB for PDFs)', async () => {
      const req = new Request('http://localhost:3000/api/mobile/v1/cloudinary/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validBearerToken}`,
        },
        body: JSON.stringify({ folder: 'pdfs', fileSize: 60 * 1024 * 1024 }),
      });

      const res = await mobileCloudinarySignPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('File size exceeds maximum allowed limit');
    });

    it('returns signed parameters on valid request', async () => {
      const req = new Request('http://localhost:3000/api/mobile/v1/cloudinary/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validBearerToken}`,
        },
        body: JSON.stringify({ folder: 'pdfs', fileSize: 10 * 1024 * 1024 }),
      });

      const res = await mobileCloudinarySignPOST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.signature).toBe('mock_cloudinary_signature_123');
      expect(data.cloudName).toBe('test_cloud');
      expect(data.apiKey).toBe('test_key');
      expect(data.folder).toBe('pdfs');
      expect(data.resource_type).toBe('raw');
    });
  });

  describe('POST /api/mobile/v1/jobs/create', () => {
    it('returns 400 when missing required title or contextPDFs', async () => {
      const req = new Request('http://localhost:3000/api/mobile/v1/jobs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validBearerToken}`,
        },
        body: JSON.stringify({ title: '', contextPDFs: [] }),
      });

      const res = await mobileJobCreatePOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation failed');
    });

    it('enqueues job in background runner and returns 200 with jobId', async () => {
      (defaultJobRunner.enqueue as jest.Mock).mockResolvedValue({
        jobId: 'job-mobile-99',
        status: 'QUEUED',
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/jobs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validBearerToken}`,
        },
        body: JSON.stringify({
          title: 'Modern Indian History Mock',
          domainTopic: 'History',
          numQuestions: 15,
          difficulty: 'medium',
          mode: 'context',
          contextPDFs: [
            {
              name: 'history_chapter4.pdf',
              url: 'https://res.cloudinary.com/test_cloud/raw/upload/history_chapter4.pdf',
              size: 2048576,
            },
          ],
        }),
      });

      const res = await mobileJobCreatePOST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.jobId).toBe('job-mobile-99');
      expect(data.status).toBe('QUEUED');
      expect(defaultJobRunner.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u-scholar-123',
          title: 'Modern Indian History Mock',
          numQuestions: 15,
        })
      );
    });
  });

  describe('GET /api/mobile/v1/jobs/[id]', () => {
    it('returns 404 when job does not exist', async () => {
      (defaultJobRunner.getJob as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/mobile/v1/jobs/non-existent', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validBearerToken}` },
      });

      const res = await mobileJobGetGET(req, { params: Promise.resolve({ id: 'non-existent' }) });
      expect(res.status).toBe(404);
    });

    it('returns 403 when job belongs to another user (IDOR prevention)', async () => {
      const error: any = new Error('Access denied: You do not own this job.');
      error.statusCode = 403;
      (defaultJobRunner.getJob as jest.Mock).mockRejectedValue(error);

      const req = new Request('http://localhost:3000/api/mobile/v1/jobs/other-user-job', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validBearerToken}` },
      });

      const res = await mobileJobGetGET(req, { params: Promise.resolve({ id: 'other-user-job' }) });
      expect(res.status).toBe(403);
    });

    it('returns job details when owned by requesting user', async () => {
      (defaultJobRunner.getJob as jest.Mock).mockResolvedValue({
        id: 'job-mobile-99',
        userId: 'u-scholar-123',
        status: 'GENERATING',
        progress: 65,
        currentStep: 4,
        totalSteps: 6,
        stage: 'Synthesizing high-yield questions with Gemini 2.5...',
        error: null,
        errorCode: null,
        testId: null,
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/jobs/job-mobile-99', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validBearerToken}` },
      });

      const res = await mobileJobGetGET(req, { params: Promise.resolve({ id: 'job-mobile-99' }) });
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.job.id).toBe('job-mobile-99');
      expect(data.job.status).toBe('GENERATING');
      expect(data.job.progress).toBe(65);
      expect(data.job.stage).toContain('Gemini 2.5');
    });
  });

  describe('GET /api/mobile/v1/jobs/[id]/stream (Server-Sent Events)', () => {
    it('establishes text/event-stream response with initial event', async () => {
      (defaultJobRunner.getJob as jest.Mock).mockResolvedValue({
        id: 'job-mobile-99',
        userId: 'u-scholar-123',
        status: 'COMPLETED',
        progress: 100,
        currentStep: 6,
        totalSteps: 6,
        stage: 'Assessment ready!',
        testId: 'test-created-123',
        error: null,
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/jobs/job-mobile-99/stream', {
        method: 'GET',
        headers: { Authorization: `Bearer ${validBearerToken}` },
      });

      const res = await mobileJobStreamGET(req, { params: Promise.resolve({ id: 'job-mobile-99' }) });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    });
  });
});
