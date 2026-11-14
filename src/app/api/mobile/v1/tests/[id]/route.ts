import { NextResponse } from 'next/server';
import { resolveAuthUser } from '@/app/lib/mobileAuth';
import { prisma } from '@/app/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  try {
    const user = await resolveAuthUser(req);
    if (!user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: true,
        pdfs: true,
      },
    });

    if (!test) {
      return NextResponse.json({ message: 'Test not found' }, { status: 404 });
    }

    const isOwner = test.userId === user.id;

    // For editing purposes, owner gets full questions with correct answers
    return NextResponse.json({
      success: true,
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        duration: test.duration,
        userId: test.userId,
        isOwner,
        createdAt: test.createdAt,
        questions: test.questions.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correctAnswer: isOwner ? q.correctAnswer : undefined,
          explanation: isOwner ? q.explanation : undefined,
          difficulty: q.difficulty || 'medium',
        })),
      },
    });
  } catch (error) {
    console.error('Mobile test fetch error:', error);
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
    const user = await resolveAuthUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description, duration, questions } = await req.json();

    const existingTest = await prisma.test.findUnique({
      where: { id },
    });

    if (!existingTest) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    if (existingTest.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this test' }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.test.update({
        where: { id },
        data: {
          ...(title ? { title: String(title).trim() } : {}),
          ...(description !== undefined ? { description: String(description).trim() } : {}),
          ...(duration ? { duration: Number(duration) } : {}),
        },
      });

      if (questions && Array.isArray(questions)) {
        await tx.question.deleteMany({ where: { testId: id } });
        await tx.question.createMany({
          data: questions.map((q: any) => ({
            testId: id,
            question: String(q.question || '').trim(),
            options: Array.isArray(q.options) ? q.options.map((o: any) => String(o).trim()) : [],
            correctAnswer: Number(q.correctAnswer) || 0,
            explanation: q.explanation ? String(q.explanation).trim() : '',
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
    console.error('Mobile test update error:', error);
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
    const user = await resolveAuthUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingTest = await prisma.test.findUnique({
      where: { id },
    });

    if (!existingTest) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    if (existingTest.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this test' }, { status: 403 });
    }

    // Delete cascading attempts, questions, and test
    await prisma.$transaction([
      prisma.testAttempt.deleteMany({ where: { testId: id } }),
      prisma.question.deleteMany({ where: { testId: id } }),
      prisma.test.delete({ where: { id } }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Test and associated attempts deleted successfully',
    });
  } catch (error) {
    console.error('Mobile test deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete test' },
      { status: 500 }
    );
  }
}

