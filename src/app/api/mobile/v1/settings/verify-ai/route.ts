import { NextResponse } from 'next/server';
import { resolveAuthUser } from '@/app/lib/mobileAuth';
import { GoogleGenAI } from '@google/genai';
import { getGenAIInstance } from '@/app/lib/ai';

export async function POST(req: Request) {
  try {
    const user = await resolveAuthUser(req);
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { provider, apiKey, model } = await req.json();

    if (provider === 'default') {
      const ai = getGenAIInstance();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: 'Respond with the exact word: "READY"',
      });
      const text = response.text || '';
      return NextResponse.json({
        success: true,
        message: 'System Gemini connection verified successfully!',
        responsePreview: text.trim().slice(0, 50),
      });
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required for custom AI providers' },
        { status: 400 }
      );
    }

    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const chosenModel = model || 'gemini-2.5-flash';
      const response = await ai.models.generateContent({
        model: chosenModel,
        contents: 'Respond with the exact word: "READY"',
      });
      const text = response.text || '';
      return NextResponse.json({
        success: true,
        message: `Google Gemini (${chosenModel}) verified successfully!`,
        responsePreview: text.trim().slice(0, 50),
      });
    }

    if (provider === 'openai') {
      const chosenModel = model || 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: chosenModel,
          messages: [{ role: 'user', content: 'Say READY' }],
          max_tokens: 5,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: data?.error?.message || 'OpenAI verification failed' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `OpenAI (${chosenModel}) verified successfully!`,
        responsePreview: data.choices?.[0]?.message?.content?.trim() || 'READY',
      });
    }

    if (provider === 'anthropic') {
      const chosenModel = model || 'claude-3-5-sonnet-20241022';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: chosenModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say READY' }],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: data?.error?.message || 'Anthropic verification failed' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Anthropic (${chosenModel}) verified successfully!`,
        responsePreview: data.content?.[0]?.text?.trim() || 'READY',
      });
    }

    if (provider === 'groq') {
      const chosenModel = model || 'llama-3.3-70b-versatile';
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: chosenModel,
          messages: [{ role: 'user', content: 'Say READY' }],
          max_tokens: 5,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: data?.error?.message || 'Groq verification failed' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Groq (${chosenModel}) verified successfully!`,
        responsePreview: data.choices?.[0]?.message?.content?.trim() || 'READY',
      });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported AI provider: ${provider}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in mobile verify-ai:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Connection verification failed' },
      { status: 500 }
    );
  }
}

