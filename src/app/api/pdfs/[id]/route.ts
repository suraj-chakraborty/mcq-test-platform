import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { objectIdSchema } from '@/app/lib/validations/common';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }>}
) {
  const id = (await params).id;
  const idValidation = objectIdSchema.safeParse(id);
  if (!idValidation.success) {
    return NextResponse.json({ message: 'Invalid PDF ID format' }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const pdf = await prisma.pdfDocument.findUnique({
      where: { id },
      include: { test: true }
    });

    if (!pdf || !pdf.test || pdf.test.userId !== session.user.id) {
      return NextResponse.json(
        { message: 'PDF not found' },
        { status: 404 }
      );
    }


    await prisma.pdfDocument.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'PDF deleted successfully',
      pdf,
    });
  } catch (error) {
    console.error('PDF delete error:', error);
    return NextResponse.json(
      { message: 'An error occurred while deleting the PDF' },
      { status: 500 }
    );
  }
}