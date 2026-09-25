import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { safeJsonParse } from '@/app/lib/validations/common';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const manualQuestionSchema = z.object({
  question: z.string().min(3, 'Question text must be at least 3 characters'),
  options: z.array(z.string().min(1, 'Option cannot be empty')).min(2, 'Must have at least 2 options').max(6),
  correctAnswer: z.number().int().min(0),
  explanation: z.string().optional().default(''),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
}).refine((q) => q.correctAnswer < q.options.length, {
  message: 'Correct answer index must be within options range',
  path: ['correctAnswer'],
});

const manualTestCreateSchema = z.object({
  title: z.string().min(3, 'Test title must be at least 3 characters').max(200),
  description: z.string().optional().default(''),
  duration: z.coerce.number().int().min(1).max(300).default(20),
  questions: z.array(manualQuestionSchema).min(1, 'At least one question is required'),
});

export async function POST(req: Request) {
  try {
    let user = await getMobileAuthUser(req);
    if (!user) {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        user = session.user as any;
      }
    }

    if (!user || !user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parseResult = await safeJsonParse(req);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = manualTestCreateSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const { title, description, duration, questions } = validation.data;

    const newTest = await prisma.test.create({
      data: {
        title,
        description,
        duration,
        userId: user.id,
        questions: {
          create: questions.map((q) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || 'Verified answer.',
            difficulty: q.difficulty,
          })),
        },
      },
      include: {
        questions: {
          select: {
            id: true,
            question: true,
            options: true,
            difficulty: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Test created successfully',
      test: {
        id: newTest.id,
        title: newTest.title,
        description: newTest.description,
        duration: newTest.duration,
        questionCount: newTest.questions.length,
        createdAt: newTest.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating manual test on mobile:', error);
    return NextResponse.json({ error: 'Failed to create assessment' }, { status: 500 });
  }
}
