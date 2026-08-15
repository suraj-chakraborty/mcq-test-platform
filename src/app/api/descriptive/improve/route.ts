import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { getGenAIInstance } from '@/app/lib/ai';
import { z } from 'zod';

const improveInputSchema = z.object({
  question: z.string(),
  answer: z.string(),
  examName: z.string(),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = improveInputSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input', details: result.error.format() }, { status: 400 });
    }

    const { question, answer, examName } = result.data;

    const prompt = `
      You are an expert evaluator for ${examName} descriptive writing section.
      Please improve the following answer while maintaining its core meaning and structure.
      Make it more concise, clear, and effective.
      Focus on:
      1. Grammar and syntax
      2. Clarity and coherence
      3. Vocabulary and expression
      4. Structure and flow
      
      Question: ${question}
      Original Answer: ${answer}
      
      Provide only the improved answer without any additional comments or explanations.
    `;

    const genAI = getGenAIInstance();
    let improvedAnswer = '';
    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.6-flash', 'gemini-3.6-flash'];
    for (const modelName of modelsToTry) {
      try {
        const aiResult = await genAI.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        if (aiResult.text) {
          improvedAnswer = aiResult.text;
          break;
        }
      } catch (err) {
        console.warn(`[improve] Model ${modelName} failed, trying next:`, err);
      }
    }

    if (!improvedAnswer) {
      throw new Error("Failed to extract improved answer from Gemini response.");
    }

    return NextResponse.json({
      success: true,
      improvedAnswer,
    });

  } catch (error) {
    console.error('Error improving answer:', error);
    return NextResponse.json(
      { error: 'Failed to improve answer' },
      { status: 500 }
    );
  }
}

