import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const search = searchParams.get('search')?.trim() || '';

    const whereClause: any = {
      test: {
        userId: session.user.id
      }
    };

    if (search) {
      whereClause.name = {
        contains: search,
        mode: 'insensitive'
      };
    }

    const [total, pdfs] = await Promise.all([
      prisma.pdfDocument.count({ where: whereClause }),
      prisma.pdfDocument.findMany({
        where: whereClause,
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
        },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    const pdfsWithTitle = pdfs.map(pdf => ({
      ...pdf,
      title: pdf.name,
      createdAt: pdf.test.createdAt,
      mcqs: { length: pdf.test._count.questions }, // Mocking mcqs.length for UI compatibility
      fileSize: pdf.fileSize,
      pageCount: pdf.pageCount
    }));

    const totalPages = Math.ceil(total / limit);
    const hasMore = page * limit < total;

    return NextResponse.json({
      pdfs: pdfsWithTitle,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore
      }
    });
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
 