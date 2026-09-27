import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { prisma } from '@/app/lib/prisma';
import { getGenAIInstance } from '@/app/lib/ai';
import { generatedMCQSchema } from '@/app/lib/validations/test';
import { safeJsonParse } from '@/app/lib/validations/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ocrMathSchema = z
  .object({
    image: z.string().max(15 * 1024 * 1024, 'Image data exceeds limit').optional(),
    query: z.string().trim().max(5000).optional(),
    topic: z.string().trim().max(100).optional().default('Mathematics'),
  })
  .strict()
  .refine((data) => !!data.image || !!data.query, {
    message: 'Either image or query must be provided',
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

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parseResult = await safeJsonParse(req, 15 * 1024 * 1024);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const validation = ocrMathSchema.safeParse(parseResult.data);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { image, query, topic } = validation.data;

    let base64Data = '';
    let mimeType = 'image/jpeg';

    if (image) {
      if (image.startsWith('http://') || image.startsWith('https://')) {
        const parsedUrl = new URL(image);
        const hostname = parsedUrl.hostname.toLowerCase();
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('10.') ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('172.16.') ||
          hostname.endsWith('.internal') ||
          hostname.endsWith('.local')
        ) {
          return NextResponse.json({ error: 'Disallowed image host' }, { status: 400 });
        }

        const imgRes = await fetch(image);
        if (!imgRes.ok) {
          return NextResponse.json({ error: 'Failed to fetch image from URL' }, { status: 400 });
        }
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        if (contentType.startsWith('image/')) {
          mimeType = contentType;
        }
        const buffer = await imgRes.arrayBuffer();
        base64Data = Buffer.from(buffer).toString('base64');
      } else {
        const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        } else {
          base64Data = image.split(',')[1] || image;
        }
      }
    }

    const ai = getGenAIInstance();
    const sanitizedTopic = topic.replace(/[<>]/g, '');

    const prompt = `
Analyze this math or science problem ${base64Data ? 'from the provided image' : 'from the provided problem statement'}.
1. Extract or restate the plain text / LaTeX equation of the problem.
2. Provide a detailed, step-by-step pedagogical solution formatted in clear Markdown.
3. Generate 5 multiple-choice questions (MCQs) that are similar in logic and difficulty.
4. Target Topic Context: <math_topic>${sanitizedTopic}</math_topic>
${query ? `\nTarget Problem Input:\n${query}\n` : ''}

Format the response EXACTLY as a JSON object with this structure:
{
  "originalQuestion": "[Extracted text/equation of the problem]",
  "solutionSteps": [
    {
      "title": "Step 1: [Short Title]",
      "content": "[Detailed explanation]",
      "math": "[Key math formula or expression for this step]"
    }
  ],
  "finalAnswer": "[The clear final result / simplified equation]",
  "title": "Math Practice: [Summary of problem]",
  "description": "Practice questions based on an uploaded image.",
  "questions": [
    {
      "question": "Question text",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": 0,
      "explanation": "Clear explanation of the solution.",
      "difficulty": "medium"
    }
  ]
}
`;

    const userParts: any[] = [{ text: prompt }];
    if (base64Data) {
      userParts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: base64Data,
        },
      });
    }

    let responseText = '';
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: userParts,
            },
          ],
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (err) {
        console.warn(`[mobile-ocr-math] Model ${modelName} failed, trying next:`, err);
      }
    }

    if (!responseText) {
      return NextResponse.json(
        { error: 'Failed to generate math MCQs from image. Please ensure the image is clear.' },
        { status: 502 }
      );
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : responseText.replace(/```json|```/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      return NextResponse.json(
        { error: 'AI output could not be parsed into structured format' },
        { status: 502 }
      );
    }

    const validationResult = generatedMCQSchema.safeParse(parsed.questions);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'AI output failed question validation' },
        { status: 502 }
      );
    }

    const test = await prisma.test.create({
      data: {
        userId: user.id,
        title: parsed.title || 'Math Practice Test',
        description: parsed.description || 'Practice questions based on an uploaded image.',
        duration: 30,
        questions: {
          create: validationResult.data.map((q) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: q.difficulty || 'medium',
          })),
        },
      },
      include: {
        questions: true,
      },
    });

    // Award +10 XP for solving
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { xp: { increment: 10 } },
      });
    } catch {
      // non-critical
    }

    const sanitizedQuestions = test.questions.map((q) => {
      const { correctAnswer, explanation, proofQuote, ...safeQ } = q;
      return safeQ;
    });

    return NextResponse.json({
      success: true,
      originalQuestion: parsed.originalQuestion || 'Extracted Problem',
      solutionSteps: Array.isArray(parsed.solutionSteps) ? parsed.solutionSteps : [],
      finalAnswer: parsed.finalAnswer || '',
      test: {
        ...test,
        questions: sanitizedQuestions,
      },
      xpEarned: 10,
    });
  } catch (error) {
    console.error('[mobile-ocr-math] Error:', error);
    return NextResponse.json({ error: 'Failed to process math image' }, { status: 500 });
  }
}
