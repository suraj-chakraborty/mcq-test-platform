import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

const evaluationInputSchema = z.object({
  examName: z.string(),
  question: z.string(),
  answer: z.string(),
  wordCount: z.number().min(0),
  timeLimit: z.number().min(1),
  timeTaken: z.number().min(0),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = evaluationInputSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input', details: result.error.format() }, { status: 400 });
    }

    const { examName, question, answer, wordCount, timeLimit, timeTaken } = result.data;

    const prompt = `
You are a strict, professional examiner for the ${examName} descriptive writing section. Evaluate the candidate’s response using clear grading criteria and objective reasoning.

--- INPUT ---
Question:
${question}

Answer:
${answer}

--- EVALUATION CRITERIA ---
Assess the answer across these dimensions:
1. Content relevance and completeness (accuracy, depth, task fulfillment)
2. Structure and organization (clarity, coherence, logical flow)
3. Language quality (grammar, vocabulary, tone, readability)

--- INSTRUCTIONS ---
- Assign a precise score from 0 to 100 based on overall performance.
- Justify the score with specific references to the answer.
- Avoid generic feedback; be concrete and actionable.
- Keep feedback concise but insightful.
- Do NOT include any markdown or extra commentary outside the JSON.

--- OUTPUT FORMAT (STRICT JSON ONLY) ---
{
  "score": number,
  "feedback": string,
  "strengths": string[],
  "areasToImprove": string[],
  "suggestions": string[]
}
`;
    const aiResult = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = aiResult.text;

    if (!text) {
      throw new Error('No text response from Gemini API');
    }

    let evaluation;
    try {
      evaluation = JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse evaluation JSON:", err);
      throw new Error("Gemini returned invalid JSON. Raw response:\n" + text);
    }

    // Save the test result
    const descriptiveTest = await prisma.descriptiveTest.create({
      data: {
        userId: session.user.id,
        examName,
        question,
        answer,
        wordCount,
        timeLimit,
        timeTaken,
        score: evaluation.score,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        areasToImprove: evaluation.areasToImprove,
        suggestions: evaluation.suggestions,
      }
    });

    return NextResponse.json({
      success: true,
      test: descriptiveTest
    });

  } catch (error) {
    console.error('Error evaluating descriptive answer:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate answer' },
      { status: 500 }
    );
  }
}
