import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { question, transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: 'No explanation provided' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
You are an expert oral examiner. Evaluate the following verbal explanation of a concept.
Question/Concept: ${question}
User's Verbal Explanation: "${transcript}"

Analyze based on:
1. **Completeness**: Did they cover all key aspects of the concept?
2. **Clarity**: Is the explanation easy to follow and logically structured?
3. **Accuracy**: Are there any factual errors?
4. **Keyword Usage**: Did they use appropriate terminology?

Provide a JSON response with:
{
  "score": (0-100),
  "feedback": "Overall summary of the explanation quality.",
  "strengths": ["list of what they did well"],
  "areasToImprove": ["list of what was missing or unclear"],
  "clarityRating": "Excellent/Good/Average/Poor",
  "completenessRating": "High/Medium/Low"
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return NextResponse.json({ success: true, evaluation: parsed });
  } catch (error) {
    console.error('Oral Exam error:', error);
    return NextResponse.json({ error: 'Failed to evaluate explanation' }, { status: 500 });
  }
}
