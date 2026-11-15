import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { safeJsonParse } from '@/app/lib/validations/common';
import { generateKnowledgeMCQs } from '@/app/lib/ai';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const generateAssessmentSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(200),
  type: z.enum(['current-affairs', 'general-knowledge', 'custom']).optional(),
  numQuestions: z.coerce.number().int().min(1).max(50).optional().default(10),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  aiProvider: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
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

    const validation = generateAssessmentSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const {
      topic,
      type,
      numQuestions,
      difficulty,
      aiProvider,
      apiKey,
      model,
    } = validation.data;

    const isCurrentAffairs =
      type === 'current-affairs' ||
      topic.toLowerCase().includes('current affair') ||
      topic.toLowerCase().includes('ca');

    const isGK =
      type === 'general-knowledge' ||
      topic.toLowerCase().includes('general knowledge') ||
      topic.toLowerCase().includes('gk');

    const canonicalTopic = isCurrentAffairs
      ? 'Current Affairs'
      : isGK
      ? 'General Knowledge'
      : topic;

    const now = new Date();
    const dateLabel = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const title = isCurrentAffairs
      ? `Current Affairs Assessment (${dateLabel})`
      : isGK
      ? 'General Knowledge & Static Awareness'
      : `${topic} Practice Assessment`;

    const description = isCurrentAffairs
      ? 'Comprehensive Current Affairs MCQs covering latest national, international, science & economic developments.'
      : isGK
      ? 'High-yield General Knowledge MCQs covering History, Geography, Polity, Science, and Economy.'
      : `AI-generated practice test on ${topic}.`;

    const customConfig =
      aiProvider || apiKey || model
        ? { provider: (aiProvider as any) || 'default', apiKey, model }
        : undefined;

    const questions = await generateKnowledgeMCQs(canonicalTopic, numQuestions, customConfig);

    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { error: 'Failed to synthesize questions for this topic.' },
        { status: 500 }
      );
    }

    const newTest = await prisma.test.create({
      data: {
        title,
        description,
        duration: Math.max(10, Math.round(questions.length * 1.5)),
        userId: user.id,
        isPublic: false, // Strictly private to creator by default
        questions: {
          create: questions.map((q: any) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || 'Verified answer.',
            difficulty: q.difficulty || difficulty || 'medium',
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
      message: 'Assessment generated successfully',
      test: {
        id: newTest.id,
        title: newTest.title,
        description: newTest.description,
        duration: newTest.duration,
        questionCount: newTest.questions.length,
        isOwner: true,
        isPublic: false,
        createdAt: newTest.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[API /api/mobile/v1/tests/generate] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error while generating test.' },
      { status: 500 }
    );
  }
}
