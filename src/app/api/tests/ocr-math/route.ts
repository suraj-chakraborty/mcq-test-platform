import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generatedMCQSchema } from '@/lib/validations/test';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image, topic } = await req.json();

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // Extract base64 content
    const base64Data = image.split(',')[1] || image;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
Analyze this image containing a math problem.
1. Extract the plain text of the problem.
2. Provide a detailed, step-by-step solution formatted in clear Markdown.
3. Generate 5 multiple-choice questions (MCQs) that are similar in logic and difficulty.
4. Topic: ${topic || 'Mathematics'}

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

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg',
        },
      },
    ]);

    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    // Validate with Zod (using our existing schema parts)
    // We might need to adjust the schema if it expects just an array
    const validationResult = generatedMCQSchema.safeParse(parsed.questions);
    if (!validationResult.success) {
      throw new Error('AI output failed validation');
    }

    const test = await prisma.test.create({
      data: {
        userId: session.user.id,
        title: parsed.title,
        description: parsed.description,
        duration: 30,
        questions: {
          create: validationResult.data.map(q => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: q.difficulty || 'medium'
          }))
        }
      },
      include: {
        questions: true
      }
    });

    return NextResponse.json({ 
      success: true, 
      test,
      originalQuestion: parsed.originalQuestion,
      solutionSteps: parsed.solutionSteps,
      finalAnswer: parsed.finalAnswer
    });
  } catch (error) {
    console.error('OCR Math error:', error);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}
