import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { objectIdSchema, safeJsonParse } from '@/app/lib/validations/common';

const updateQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().trim().min(1, 'Question text cannot be empty').max(2000),
      options: z.array(z.string().trim().min(1).max(1000)).min(2).max(6),
      correctAnswer: z.number().int().min(0).max(5),
      explanation: z.string().max(2000).optional().default(''),
      difficulty: z.string().max(50).optional().default('medium'),
    }).strict()
  ).min(1, 'At least one question is required').max(100, 'Cannot exceed 100 questions per test'),
}).strict();

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  const idValidation = objectIdSchema.safeParse(id);
  if (!idValidation.success) {
    return NextResponse.json({ error: 'Invalid test ID format' }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parseResult = await safeJsonParse(request);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const schemaValidation = updateQuestionsSchema.safeParse(parseResult.data);
    if (!schemaValidation.success) {
      return NextResponse.json(
        { error: 'Invalid questions data', details: schemaValidation.error.format() },
        { status: 400 }
      );
    }

    const { questions } = schemaValidation.data;

    const test = await prisma.test.findFirst({
      where: { id, userId: session.user.id }
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Update questions: Delete old ones and create new ones
    await prisma.$transaction([
      prisma.question.deleteMany({ where: { testId: id } }),
      prisma.question.createMany({
        data: questions.map((q) => ({
          testId: id,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium'
        }))
      })
    ]);

    const updatedTest = await prisma.test.findUnique({
      where: { id },
      include: { questions: true }
    });

    return NextResponse.json({
      success: true,
      test: updatedTest
    });

  } catch (error) {
    console.error('Error updating questions:', error);
    return NextResponse.json(
      { error: 'Failed to update questions' },
      { status: 500 }
    );
  }
}
