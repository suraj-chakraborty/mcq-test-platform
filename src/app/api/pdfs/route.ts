import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const pdfs = await prisma.pdfDocument.findMany({
      where: {
        test: {
          userId: session.user.id
        }
      },
      include: {
        test: {
          select: {
            createdAt: true,
            _count: {
              select: { questions: true }
            }
          }
        }
      },
      orderBy: {
        id: 'desc'
      }
    });

    const pdfsWithTitle = pdfs.map(pdf => ({
      ...pdf,
      title: pdf.name,
      createdAt: pdf.test.createdAt,
      mcqs: { length: pdf.test._count.questions }, // Mocking mcqs.length for UI compatibility
      fileSize: pdf.fileSize,
      pageCount: pdf.pageCount
    }));

    return NextResponse.json({ pdfs: pdfsWithTitle });
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
 