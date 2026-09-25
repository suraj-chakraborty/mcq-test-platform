import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { getGenAIInstance } from '@/app/lib/ai';
import { generatedMCQSchema } from '@/app/lib/validations/test';
import { safeJsonParse } from '@/app/lib/validations/common';

const ocrMathSchema = z.object({
  image: z.string().min(1, 'Image is required').max(10 * 1024 * 1024, 'Image data exceeds 10MB limit'),
  topic: z.string().trim().max(100).optional().default('Mathematics'),
}).strict();

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parseResult = await safeJsonParse(req, 10 * 1024 * 1024);
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

    const { image, topic } = validation.data;

    // Extract base64 content
    const base64Data = image.split(',')[1] || image;

    const ai = getGenAIInstance();

    const sanitizedTopic = topic.replace(/[<>]/g, '');

    const prompt = `
Analyze this image containing a math problem.
1. Extract the plain text of the problem.
2. Provide a detailed, step-by-step solution formatted in clear Markdown.
3. Generate 5 multiple-choice questions (MCQs) that are similar in logic and difficulty.
4. Target Topic Context: <math_topic>${sanitizedTopic}</math_topic>


Format the response EXACTLY as a JSON object with this structure:
{
  "originalQuestion": "[Extracted text of the problem]",
  "solutionSteps": [
    {
      "title": "Step 1: [Short Title]",
      "content": "[Detailed explanation]",
      "math": "[The key math formula for this step, using simple text notation like x^2]"
    }
  ],
  "finalAnswer": "[The final result]",
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

    let responseText = '';
    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.6-flash', 'gemini-3.6-flash'];
    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (err) {
        console.warn(`[ocr-math] Model ${modelName} failed, trying next:`, err);
      }
    }

    if (!responseText) {
      throw new Error('Failed to generate math MCQs from image');
    }
    const cleanJson = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    const validationResult = generatedMCQSchema.safeParse(parsed.questions);
    if (!validationResult.success) {
      throw new Error('AI output failed validation');
    }

    const test = await prisma.test.create({
      data: {
        userId: session.user.id,
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

    const sanitizedQuestions = test.questions.map((q) => {
      const { correctAnswer, explanation, proofQuote, ...safeQ } = q;
      return safeQ;
    });

    return NextResponse.json({
      success: true,
      test: {
        ...test,
        questions: sanitizedQuestions,
      },
      originalQuestion: parsed.originalQuestion,
      solutionSteps: parsed.solutionSteps,
      finalAnswer: parsed.finalAnswer,
    });
  } catch (error) {
    console.error('OCR Math error:', error);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}
