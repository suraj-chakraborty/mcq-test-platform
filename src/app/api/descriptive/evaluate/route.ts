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
      You are an expert evaluator for ${examName} descriptive writing section.
      Please evaluate the following answer and provide detailed feedback:
      
      Question: ${question}
      Answer: ${answer}
      
      Please provide:
      1. A score out of 100
      2. Detailed feedback on content, structure, and language
      3. List of strengths
      4. List of areas to improve
      5. Specific suggestions for improvement
      
      Format the response as a JSON object with these exact fields (do not include markdown wrapping):
      {
        "score": number,
        "feedback": string,
        "strengths": string[],
        "areasToImprove": string[],
        "suggestions": string[]
      }
    `;

    const aiResult = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-001',
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