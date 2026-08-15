'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  BookOpen, 
  Search, 
  Sparkles, 
  Clock, 
  FileText, 
  ArrowRight, 
  Swords, 
  Brain, 
  Plus, 
  Filter,
  CheckCircle2,
  Trophy
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';

interface TestItem {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  questions?: any[];
  createdAt?: string;
  pdfs?: any[];
}

export default function TestsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [tests, setTests] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'pdf' | 'predefined'>('all');
  const [startingTestId, setStartingTestId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    fetchTests();
  }, [status, router]);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const [resTests, resPdfTests] = await Promise.all([
        fetch('/api/tests').then((r) => r.json()).catch(() => ({ tests: [] })),
        fetch('/api/pdf-tests').then((r) => r.json()).catch(() => ({ tests: [] })),
      ]);

      const combined = [...(resTests.tests || []), ...(resPdfTests.tests || [])];
      // Deduplicate by ID
      const unique = Array.from(new Map(combined.map((t) => [t.id, t])).values());
      setTests(unique);
    } catch (err) {
      console.error('Error loading tests:', err);
      toast.error('Failed to load tests library');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPredefined = async (type: 'current-affairs' | 'general-knowledge') => {
    try {
      setStartingTestId(type);
      const res = await fetch('/api/tests/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, count: 10 }),
      });
      const data = await res.json();
      if (res.ok && (data.testId || data.id)) {
        router.push(`/take-test/${data.testId || data.id}`);
      } else {
        throw new Error(data.error || 'Failed to start test');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error starting test');
    } finally {
      setStartingTestId(null);
    }
  };

  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    });
  }, [tests, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafc] dark:bg-neutral-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-neutral-800 pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider mb-2">
              <BookOpen className="w-3.5 h-3.5" /> Assessment Catalog
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
              Explore & Practice Tests
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-1">
              Select an uploaded PDF assessment or jump into AI knowledge sprints.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Test</span>
            </Link>
          </div>
        </div>

        {/* Quick Launch Predefined Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-card p-6 rounded-3xl border border-indigo-100 dark:border-indigo-950/80 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Current Affairs Rapid Sprint</h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                10 curated questions on global events, policies, science, economy, and national updates.
              </p>
            </div>
            <Button
              disabled={startingTestId === 'current-affairs'}
              onClick={() => handleStartPredefined('current-affairs')}
              className="mt-6 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider"
            >
              {startingTestId === 'current-affairs' ? 'Generating...' : 'Start Current Affairs Sprint'}
            </Button>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-purple-100 dark:border-purple-950/80 bg-gradient-to-br from-purple-500/5 to-pink-500/5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">General Knowledge Mastery</h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Comprehensive questions covering geography, history, polity, general science, and fundamentals.
              </p>
            </div>
            <Button
              disabled={startingTestId === 'general-knowledge'}
              onClick={() => handleStartPredefined('general-knowledge')}
              className="mt-6 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider"
            >
              {startingTestId === 'general-knowledge' ? 'Generating...' : 'Start General Knowledge Sprint'}
            </Button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests by title, subject, or keywords..."
              className="h-12 pl-11 rounded-2xl bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-sm font-medium"
            />
          </div>
        </div>

        {/* Test Library Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">
              My Uploaded PDF Assessments ({filteredTests.length})
            </h2>
          </div>

          {filteredTests.length === 0 ? (
            <Card className="glass-card rounded-3xl p-12 text-center border-dashed border-2">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-gray-400 mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">No assessments found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-6 font-medium">
                {searchQuery ? 'Try adjusting your search query.' : 'Upload your first PDF notes or question paper to generate a test.'}
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Upload PDF Document</span>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTests.map((test) => {
                const questionCount = test.questions?.length || 10;
                const durationMins = test.duration || Math.max(10, questionCount * 2);

                return (
                  <Card
                    key={test.id}
                    className="glass-card rounded-3xl overflow-hidden hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group flex flex-col justify-between"
                  >
                    <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider border border-indigo-200/40">
                            Verified Source
                          </span>
                          <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
                            <Clock className="w-3 h-3" />
                            <span>{durationMins}m</span>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-base font-black text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors line-clamp-2">
                            {test.title}
                          </h3>
                          {test.description && (
                            <p className="text-xs text-gray-500 line-clamp-2 mt-1 font-medium">
                              {test.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-neutral-800">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-600 dark:text-gray-400">
                          <span>{questionCount} Questions</span>
                          <span className="text-emerald-600 dark:text-emerald-400">AI Citations Ready</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={() => router.push(`/take-test/${test.id}`)}
                            className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-indigo-500/10"
                          >
                            <span>Take Test</span>
                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Button>

                          <Button
                            variant="outline"
                            onClick={() => router.push(`/leaderboard/${test.id}`)}
                            className="h-11 rounded-xl border-gray-200 dark:border-neutral-700 font-bold text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-center gap-1"
                          >
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <span>Rank</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}