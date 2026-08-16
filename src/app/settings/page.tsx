'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useSettings, ThemeMode, CardPalette, AIProvider } from '@/app/providers/SettingsProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Sun,
  Moon,
  Laptop,
  Sparkles,
  Bot,
  Key,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
  Shield,
  Layers,
  ArrowLeft,
  Sliders,
  Check,
  LogOut,
  User
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const {
    themeMode,
    setThemeMode,
    cardPalette,
    setCardPalette,
    aiProvider,
    setAiProvider,
    aiApiKey,
    setAiApiKey,
    aiModel,
    setAiModel,
    resetSettings,
  } = useSettings();

  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setIsTestingKey(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/settings/verify-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiProvider,
          apiKey: aiApiKey,
          model: aiModel,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: data.message });
        toast.success(data.message || 'AI Connection Verified!');
      } else {
        setTestResult({ success: false, message: data.error || 'Connection verification failed' });
        toast.error(data.error || 'Connection failed');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error testing API connection';
      setTestResult({ success: false, message: errMsg });
      toast.error(errMsg);
    } finally {
      setIsTestingKey(false);
    }
  };

  const providers: { id: AIProvider; name: string; desc: string; defaultModel: string; badge: string }[] = [
    {
      id: 'default',
      name: 'Platform Default (Google Gemini)',
      desc: 'Built-in high-performance multimodal Gemini engine. Zero configuration required.',
      defaultModel: 'gemini-2.5-flash',
      badge: 'Zero Config',
    },
    {
      id: 'gemini',
      name: 'Google Gemini (Personal Key)',
      desc: 'Use your own Google AI Studio API key with Gemini 2.5 Flash / Pro quotas.',
      defaultModel: 'gemini-2.5-flash',
      badge: 'BYOK',
    },
    {
      id: 'openai',
      name: 'OpenAI (GPT-4o)',
      desc: 'Connect your personal OpenAI platform API key for GPT-4o and GPT-4o-mini.',
      defaultModel: 'gpt-4o-mini',
      badge: 'BYOK',
    },
    {
      id: 'anthropic',
      name: 'Anthropic (Claude 3.5)',
      desc: 'Use Claude 3.5 Sonnet / Haiku for pedagogical analysis and nuanced reasoning.',
      defaultModel: 'claude-3-5-haiku-20241022',
      badge: 'BYOK',
    },
    {
      id: 'groq',
      name: 'Groq Cloud (Llama 3.3)',
      desc: 'Ultra-low latency inference using Groq Llama 3.3 70B Versatile.',
      defaultModel: 'llama-3.3-70b-versatile',
      badge: 'High Speed',
    },
  ];

  const palettes: { id: CardPalette; name: string; desc: string; colorPreview: string[] }[] = [
    {
      id: 'dynamic',
      name: 'Dynamic Multi-Color',
      desc: 'Vibrant rotation across 8 tailored color schemes for maximum visual clarity.',
      colorPreview: ['#3B82F6', '#10B981', '#6366F1', '#EA580C', '#E11D48'],
    },
    {
      id: 'indigo',
      name: 'Indigo SaaS Classic',
      desc: 'Unified, elegant royal indigo tones across all cards and action items.',
      colorPreview: ['#4F46E5', '#6366F1', '#818CF8', '#A5B4FC'],
    },
    {
      id: 'emerald',
      name: 'Emerald Mint Focus',
      desc: 'Calm, focused green and teal tones for active recall and intensive study.',
      colorPreview: ['#059669', '#10B981', '#34D399', '#0D9488'],
    },
    {
      id: 'slate',
      name: 'Slate Enterprise',
      desc: 'Serious, understated monochrome aesthetic with crisp neutral borders.',
      colorPreview: ['#1E293B', '#334155', '#475569', '#64748B'],
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafafc] dark:bg-neutral-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-neutral-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-8 w-8 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Settings & Preferences
              </h1>
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-500 pl-10">
              Customize visual theme mode, card palettes, and AI provider credentials.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetSettings();
              toast.success('Settings reset to defaults');
            }}
            className="rounded-lg text-xs font-semibold h-9 gap-1.5 text-gray-600 dark:text-gray-400"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </Button>
        </div>

        {/* SECTION 1: Appearance & Theme Mode */}
        <Card className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          <CardHeader className="p-5 pb-3 border-b border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-900 dark:text-white">Theme & Display Mode</CardTitle>
                <CardDescription className="text-xs font-medium">Select your interface light, dark, or system preference</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-6">
            {/* Theme Mode Selector */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'light' as ThemeMode, label: 'Light', icon: Sun },
                { id: 'dark' as ThemeMode, label: 'Dark', icon: Moon },
                { id: 'system' as ThemeMode, label: 'System Auto', icon: Laptop },
              ].map((item) => {
                const Icon = item.icon;
                const active = themeMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setThemeMode(item.id)}
                    className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border transition-all text-center ${active
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm'
                        : 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 hover:border-gray-300 font-medium'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Card Palette Theming Selector */}
            <div className="space-y-3 pt-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Assessment Card Palette Style
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {palettes.map((p) => {
                  const active = cardPalette === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setCardPalette(p.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${active
                          ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/30 shadow-sm'
                          : 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{p.name}</span>
                        {active && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <p className="text-[11px] font-medium text-gray-500 leading-relaxed">{p.desc}</p>
                      <div className="flex items-center gap-1.5 pt-1">
                        {p.colorPreview.map((c, i) => (
                          <div key={i} className="w-4 h-4 rounded-full shadow-xs" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: AI Provider & BYOK Configuration */}
        <Card className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          <CardHeader className="p-5 pb-3 border-b border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-900 dark:text-white">AI Engine & Model Provider</CardTitle>
                <CardDescription className="text-xs font-medium">Choose between platform defaults or bring your personal API key</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-6">
            {/* Provider Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {providers.map((p) => {
                const active = aiProvider === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setAiProvider(p.id);
                      if (p.id === 'default') {
                        setAiModel('');
                      } else {
                        setAiModel(p.defaultModel);
                      }
                      setTestResult(null);
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${active
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 shadow-sm'
                        : 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{p.name}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${active ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'}`}>
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-gray-500 leading-relaxed">{p.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Custom API Key Input (if not default) */}
            {aiProvider !== 'default' ? (
              <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-neutral-800">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      {providers.find((p) => p.id === aiProvider)?.name} API Key
                    </Label>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" /> Stored locally in your browser
                    </span>
                  </div>

                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder={`Enter your ${aiProvider.toUpperCase()} API key (e.g. sk-...)`}
                      value={aiApiKey}
                      onChange={(e) => {
                        setAiApiKey(e.target.value);
                        setTestResult(null);
                      }}
                      className="pr-10 h-10 rounded-lg bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Model Name / Alias</Label>
                  <Input
                    placeholder="e.g. gpt-4o-mini, gemini-2.5-flash, claude-3-5-haiku"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="h-10 rounded-lg bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-xs font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-3">
                <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <p className="text-xs font-medium text-indigo-900 dark:text-indigo-200">
                  Default mode uses the platform's multi-key load-balanced Google Gemini engine. You don't need to provide any API key.
                </p>
              </div>
            )}

            {/* Test Connection Button & Result Feedback */}
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <Button
                onClick={handleTestConnection}
                disabled={isTestingKey || (aiProvider !== 'default' && !aiApiKey.trim())}
                className="h-10 px-5 rounded-lg bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all"
              >
                {isTestingKey ? 'Verifying...' : 'Test API Connection'}
              </Button>

              {testResult && (
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: Account & Session Management */}
        <Card className="border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="p-6 pb-4 border-b border-gray-100 dark:border-neutral-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                    Account & Session
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500">
                    Manage active sign-in session and account authentication
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                  {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">{session?.user?.name || 'Logged in User'}</h4>
                  <p className="text-[11px] text-gray-500">{session?.user?.email || 'Active Session'}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="h-10 px-5 rounded-lg border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold flex items-center gap-2 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out of Account</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
