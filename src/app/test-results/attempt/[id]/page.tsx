'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LoadingSpinner as Loading } from '@/app/components/LoadingSpinner';
import { FormattedHeader } from '@/app/components/FormattedHeader';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  proofQuote?: string;
  pageReference?: string;
  citationType?: 'VERBATIM_PROOF' | 'LOGICAL_DEDUCTION';
}

interface TestResult {
  id: string;
  score: number;
  answers?: number[];
  completed: boolean;
  createdAt: string;
  correctAnswers?: number;
  wrongAnswers?: number;
  totalQuestions?: number;
  test?: {
    title: string;
    questions: Question[];
  };
  questions?: Question[];
}

export default function TestResultsPage() {
  const params = useParams();
  const router = useRouter();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        if (!params.id || params.id === 'undefined') {
          toast.error('Invalid test attempt');
          router.push('/dashboard');
          return;
        }
        const response = await fetch(`/api/tests/attempts/${params.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch test results');
        }

        const data = await response.json();

        // Handle array response - find the specific attempt
        if (Array.isArray(data)) {
          const specificAttempt = data.find((attempt) => attempt.id === params.id);
          if (!specificAttempt) {
            throw new Error('Test attempt not found');
          }
          setResult(specificAttempt);
        } else {
          setResult(data);
        }
      } catch (error) {
        console.error('Error fetching test results:', error);
        toast.error('Failed to load test results');
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [params.id, router]);

  if (loading) {
    return <Loading />;
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Test results not found</div>
      </div>
    );
  }

  const questionsList = result.questions || result.test?.questions || [];
  const totalQ = result.totalQuestions || questionsList.length || 1;
  const rawScore = result.score;
  const percentage = Math.round((rawScore / totalQ) * 100);
  const passed = percentage >= 50;

  return (
    <div className="min-h-screen bg-[#fafafc] dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white dark:bg-neutral-900 shadow-xl rounded-3xl p-8 border border-gray-100 dark:border-neutral-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-gray-100 dark:border-neutral-800">
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Test Results</h1>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                {result.test?.title || 'MCQ Assessment'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {passed ? 'Passed' : 'Needs Practice'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
              <p className="text-xs font-black uppercase text-indigo-400 tracking-wider">Score</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{rawScore}</span>
                <span className="text-lg font-bold text-gray-400">/ {totalQ}</span>
                <span className="text-sm font-black text-indigo-500 ml-auto">{percentage}%</span>
              </div>
            </div>

            <div className="bg-green-50/60 dark:bg-green-950/30 p-6 rounded-2xl border border-green-100 dark:border-green-900/40">
              <p className="text-xs font-black uppercase text-green-500 tracking-wider">Correct Answers</p>
              <p className="text-4xl font-black text-green-600 dark:text-green-400 mt-2">{rawScore}</p>
            </div>

            <div className="bg-gray-50 dark:bg-neutral-800/40 p-6 rounded-2xl border border-gray-100 dark:border-neutral-700/50">
              <p className="text-xs font-black uppercase text-gray-400 tracking-wider">Total Questions</p>
              <p className="text-4xl font-black text-gray-900 dark:text-white mt-2">{totalQ}</p>
            </div>
          </div>

          {questionsList.length > 0 && (
            <div className="space-y-6 pt-6 border-t border-gray-100 dark:border-neutral-800">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Detailed Question Breakdown</h2>
              {questionsList.map((q, idx) => {
                const userAns = result.answers ? result.answers[idx] : undefined;
                const isCorrect = userAns === q.correctAnswer;

                return (
                  <div
                    key={q.id || idx}
                    className="p-6 rounded-2xl bg-white dark:bg-neutral-800/60 border border-gray-100 dark:border-neutral-700/60 shadow-sm"
                  >
                    <div className="flex gap-4 items-start mb-4">
                      <span className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full font-black text-xs ${
                        isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 font-bold text-gray-900 dark:text-white">
                        <FormattedHeader text={q.question} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12 mb-4">
                      {q.options.map((opt, optIdx) => {
                        const isThisCorrect = optIdx === q.correctAnswer;
                        const isThisChosen = optIdx === userAns;

                        return (
                          <div
                            key={optIdx}
                            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
                              isThisCorrect
                                ? 'border-green-500 bg-green-50/50 text-green-800 dark:bg-green-950/40 dark:text-green-200'
                                : isThisChosen
                                ? 'border-red-500 bg-red-50/50 text-red-800 dark:bg-red-950/40 dark:text-red-200'
                                : 'border-gray-100 dark:border-neutral-700 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            <span>{opt}</span>
                            {isThisCorrect && (
                              <span className="text-[9px] uppercase font-black tracking-widest bg-green-200 text-green-800 px-1.5 py-0.5 rounded">
                                Correct
                              </span>
                            )}
                            {isThisChosen && !isThisCorrect && (
                              <span className="text-[9px] uppercase font-black tracking-widest bg-red-200 text-red-800 px-1.5 py-0.5 rounded">
                                Your Choice
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="ml-12 p-4 rounded-xl bg-gray-50 dark:bg-neutral-800 text-xs text-gray-700 dark:text-gray-300 font-medium">
                        <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Explanation</span>
                        {q.explanation}
                      </div>
                    )}

                    {q.proofQuote && (
                      <div className="ml-12 mt-3 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40">
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
                              Verified from Source
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {q.pageReference && (
                              <span className="bg-white/90 dark:bg-black/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200/50">
                                📄 {q.pageReference}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                              q.citationType === 'LOGICAL_DEDUCTION'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200'
                            }`}>
                              {q.citationType === 'LOGICAL_DEDUCTION' ? '💡 Logical Deduction' : '🛡️ Verbatim Proof'}
                            </span>
                          </div>
                        </div>
                        <blockquote className="text-xs text-emerald-950 dark:text-emerald-100 font-medium italic border-l-2 border-emerald-400 pl-3 leading-relaxed">
                          "{q.proofQuote}"
                        </blockquote>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-12 flex justify-end">
            <button
              onClick={() => router.push('/dashboard')}
              className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all hover:-translate-y-0.5"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}