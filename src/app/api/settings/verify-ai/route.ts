import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { RateLimiterService } from '@/app/lib/rateLimiter';
import { GoogleGenAI } from '@google/genai';
import { getGenAIInstance } from '@/app/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimiterService = new RateLimiterService();
    const isProd = process.env.NODE_ENV === 'production';
    const limitResult = await rateLimiterService.checkLimit('heavy', `user:${session.user.id}`, isProd);
    if (!limitResult.allowed) {
      const resetTime = typeof limitResult.reset === 'number' ? limitResult.reset : Date.now() + 60000;
      const retryAfter = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000)).toString();
      return NextResponse.json(
        {
          success: false,
          error: 'Too many verification attempts. Please wait before verifying again.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter,
          },
        }
      );
    }

    const { provider, apiKey, model } = await req.json();

    if (provider === 'default') {
      const ai = getGenAIInstance();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
          messages: [{ role: 'user', content: 'Respond with the exact word: "READY"' }],
          max_tokens: 10,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `OpenAI returned status ${res.status}`);
      }

      const data = await res.json();
      return NextResponse.json({
        success: true,
        message: `OpenAI (${chosenModel}) connection verified successfully!`,
        responsePreview: data.choices?.[0]?.message?.content?.trim() || 'READY',
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
          messages: [{ role: 'user', content: 'Respond with the exact word: "READY"' }],
          max_tokens: 10,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Groq returned status ${res.status}`);
      }

      const data = await res.json();
      return NextResponse.json({
        success: true,
        message: `Groq (${chosenModel}) connection verified successfully!`,
        responsePreview: data.choices?.[0]?.message?.content?.trim() || 'READY',
      });
    }

    if (provider === 'anthropic') {
      const chosenModel = model || 'claude-3-5-haiku-20241022';
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
          messages: [{ role: 'user', content: 'Respond with the exact word: "READY"' }],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Anthropic returned status ${res.status}`);
      }

      const data = await res.json();
      return NextResponse.json({
        success: true,
        message: `Anthropic Claude (${chosenModel}) connection verified successfully!`,
        responsePreview: data.content?.[0]?.text?.trim() || 'READY',
      });
    }

    return NextResponse.json({ success: false, error: 'Unsupported AI provider' }, { status: 400 });
  } catch (error) {
    console.error('AI Verification Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect to AI provider',
      },
      { status: 500 }
    );
  }
}
