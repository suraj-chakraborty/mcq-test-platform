import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: true,
        pdfs: true,
      },
    });

    if (!test || test.userId !== session.user.id) {
      return NextResponse.json(
        { message: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Test fetched successfully',
      test,
    });
  } catch (error) {
    console.error('Test fetch error:', error);
    return NextResponse.json(
      { message: 'An error occurred while fetching the test' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, duration, questions } = await req.json();

    const existingTest = await prisma.test.findUnique({
      where: { id },
    });

    if (!existingTest || existingTest.userId !== session.user.id) {
      return NextResponse.json({ error: 'Test not found or unauthorized' }, { status: 404 });
    }

    // Update test and its questions
    await prisma.$transaction(async (tx) => {
      await tx.test.update({
        where: { id },
        data: {
          ...(title ? { title } : {}),
          ...(duration ? { duration: Number(duration) } : {}),
        },
      });

      if (questions && Array.isArray(questions)) {
        await tx.question.deleteMany({ where: { testId: id } });
        await tx.question.createMany({
          data: questions.map((q: any) => ({
            testId: id,
            question: q.question,
            options: q.options,
            correctAnswer: Number(q.correctAnswer) || 0,
            explanation: q.explanation || '',
            difficulty: q.difficulty || 'medium',
          })),
        });
      }
    });

    const updatedTest = await prisma.test.findUnique({
      where: { id },
      include: { questions: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Test updated successfully',
      test: updatedTest,
    });
  } catch (error) {
    console.error('Test update error:', error);
    return NextResponse.json(
      { error: 'Failed to update test' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingTest = await prisma.test.findUnique({
      where: { id },
    });

    if (!existingTest || existingTest.userId !== session.user.id) {
      return NextResponse.json({ error: 'Test not found or unauthorized' }, { status: 404 });
    }

    await prisma.test.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Test deleted successfully',
    });
  } catch (error) {
    console.error('Test deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete test' },
      { status: 500 }
    );
  }
}