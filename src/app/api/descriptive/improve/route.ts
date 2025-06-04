import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { question, answer, examName } = await request.json();

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

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: [prompt],
    });

    const improvedAnswer = result.candidates[0]?.content?.parts[0]?.text;

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
