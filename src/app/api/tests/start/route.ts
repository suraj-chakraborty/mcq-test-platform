import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { GoogleGenAI } from '@google/genai';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { generateMCQs, generateKnowledgeMCQs } from '@/app/lib/ai';

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

const predefinedTests = {
  'current-affairs': {
    title: 'Current Affairs Test',
    description: 'Test your knowledge of recent events and current affairs',
    duration: 15,
    questions: [
      {
        question: 'Which country hosted the 28th UN Climate Change Conference (COP28) in 2023?',
        options: ['United Arab Emirates', 'Egypt', 'United Kingdom', 'Azerbaijan'],
        correctAnswer: 0,
        explanation: 'COP28 was hosted by the UAE in Dubai.'
      },
    ],
  },
  'general-knowledge': {
    title: 'General Knowledge Test',
    description: 'Test your general knowledge across various subjects',
    duration: 15,
    questions: [
      {
        question: 'What is the powerhouse of the eukaryotic cell where ATP synthesis occurs?',
        options: ['Ribosome', 'Mitochondria', 'Endoplasmic Reticulum', 'Golgi Apparatus'],
        correctAnswer: 1,
        explanation: 'Mitochondria are responsible for cellular respiration and ATP generation.'
      },
    ],
  },
};

async function generateGeneralKnowledgeQuestions(count: number = 10, customConfig?: any) {
  const mcqs = await generateKnowledgeMCQs('General Knowledge', count, customConfig);
  return {
    title: 'General Knowledge Test',
    description: 'Comprehensive GK assessment covering History, Science, Geography, and Polity',
    duration: Math.max(10, count),
    questions: mcqs,
  };
}

async function generateCurrentAffairsQuestions(count: number = 10, customConfig?: any) {
  const mcqs = await generateKnowledgeMCQs('Current Affairs', count, customConfig);
  return {
    title: 'Current Affairs Test',
    description: 'Latest National & International Current Affairs assessment',
    duration: Math.max(10, count),
    questions: mcqs,
  };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, pdfIds, count, customConfig } = await request.json();
    const finalCount = count ? parseInt(count) : 10;

    let testData: any;

    if (type === 'current-affairs') {
      testData = await generateCurrentAffairsQuestions(finalCount, customConfig);
    } else if (type === 'general-knowledge') {
      testData = await generateGeneralKnowledgeQuestions(finalCount, customConfig);
    } else if (type in predefinedTests) {
      testData = predefinedTests[type as keyof typeof predefinedTests];
    } else if (pdfIds && Array.isArray(pdfIds) && pdfIds.length > 0) {
      // Handle PDF-based test (finding existing tests with these PDFs)
      // Actually the original logic seemed to assume `Pdf` model had `mcqs`.
      // In our new schema, `Test` has `questions` and `pdfs`.
      // So we probably want to find the Tests that have these PDF IDs.
      const tests = await prisma.test.findMany({
        where: {
          pdfs: {
            some: {
              id: { in: pdfIds }
            }
          },
          userId: session.user.id
        },
        include: {
          questions: true,
          pdfs: true
        }
      });

      if (tests.length === 0) {
        return NextResponse.json({ error: 'No Tests found for these PDF IDs' }, { status: 404 });
      }

      const combinedQuestions = tests.flatMap((t: any) => t.questions);

      if (combinedQuestions.length === 0) {
        return NextResponse.json({ error: 'No questions found associated with these PDFs' }, { status: 400 });
      }

      testData = {
        title: tests.length === 1 
          ? `Test from ${tests[0].pdfs[0].name}`
          : `Combined Test from ${tests.length} PDFs`,
        description: 'Test generated from your uploaded PDFs',
        duration: 30,
        questions: combinedQuestions,
      };
    } else {
      return NextResponse.json({ error: 'Invalid test type or PDF IDs' }, { status: 400 });
    }

    // Save as a new Test record in Prisma
    const test = await prisma.test.create({
      data: {
        userId: session.user.id,
        title: testData.title,
        description: testData.description,
        duration: testData.duration,
        questions: {
          create: testData.questions.map((q: any) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || ''
          }))
        }
      }
    });

    return NextResponse.json({
      success: true,
      testId: test.id,
      title: test.title,
      questionCount: testData.questions.length,
    });
  } catch (error) {
    console.error('Test creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
