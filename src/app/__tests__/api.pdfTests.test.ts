import { GET as getPdfTests } from '../api/pdf-tests/route';
import { GET as getSinglePdfTest, DELETE as deletePdfTest } from '../api/pdf-tests/[id]/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';

jest.mock('next-auth');
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    test: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe('PDF Tests API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/pdf-tests', () => {
    it('returns paginated list of PDF tests for user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.test.findMany as jest.Mock).mockResolvedValue([
        { id: 'pdf_test_1', title: 'Biology Notes', pdfs: [{ id: 'pdf1' }], questions: [] },
      ]);
      (prisma.test.count as jest.Mock).mockResolvedValue(1);

      const req = new Request('http://localhost:3000/api/pdf-tests?page=1&limit=10');
      const res = await getPdfTests(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tests).toHaveLength(1);
    });
  });

  describe('GET /api/pdf-tests/[id]', () => {
    it('returns single PDF test with citations and proofQuotes', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: 'pdf_test_1',
        title: 'Biology Notes',
        userId: 'u1',
        questions: [
          {
            id: 'q1',
            question: 'What is mitochondria?',
            options: ['Powerhouse of cell', 'Control center'],
            correctAnswer: 0,
            proofQuote: 'Mitochondria generates most chemical energy',
            pageReference: 'Page 12, Paragraph 2',
          },
        ],
      });

      const req = new Request('http://localhost:3000/api/pdf-tests/pdf_test_1');
      const res = await getSinglePdfTest(req, { params: Promise.resolve({ id: 'pdf_test_1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.test.questions[0].proofQuote).toContain('Mitochondria generates');
    });
  });

  describe('DELETE /api/pdf-tests/[id]', () => {
    it('deletes user PDF test successfully', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: 'pdf_test_1',
        userId: 'u1',
      });
      (prisma.test.delete as jest.Mock).mockResolvedValue({ id: 'pdf_test_1' });

      const req = new Request('http://localhost:3000/api/pdf-tests/pdf_test_1', { method: 'DELETE' });
      const res = await deletePdfTest(req, { params: Promise.resolve({ id: 'pdf_test_1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.test.delete).toHaveBeenCalled();
    });
  });
});
