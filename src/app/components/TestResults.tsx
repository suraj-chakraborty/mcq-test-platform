'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { FormattedHeader } from './FormattedHeader';

interface QuestionResult {
  question: string;
  yourAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
}

interface TestResultsProps {
  results: {
    score: number;
    totalQuestions: number;
    percentage: number;
    results?: QuestionResult[];
    questions?: any[];
    test?: {
      questions?: any[];
    };
    attemptId?: string;
  };
  onClose: () => void;
}

export default function TestResults({ results, onClose }: TestResultsProps) {
  const router = useRouter();

  // If user in result section tries to go back, close results and stay on dashboard
  React.useEffect(() => {
    window.history.pushState(null, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onClose]);

  const rawQuestions = results.results || results.questions || results.test?.questions || [];
  const total = results.totalQuestions || rawQuestions.length || 1;
  const pct = typeof results.percentage === 'number' ? results.percentage : Math.round((results.score / total) * 100);

  return (
    <div className="container mx-auto py-4 sm:py-8 px-2.5 sm:px-4">
      <Card className="border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl">
        <CardHeader className="py-4 sm:py-6 px-4 sm:px-6 border-b border-gray-100 dark:border-neutral-800">
          <CardTitle className="text-xl sm:text-2xl font-black flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 sm:h-9 sm:w-9 bg-white dark:bg-neutral-800 rounded-xl p-1 flex items-center justify-center shadow-sm border border-gray-200 dark:border-neutral-700">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight">Test Performance</span>
            </div>
            <span className="text-gray-400 font-bold text-xs sm:text-sm uppercase tracking-widest">Report</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 sm:pt-8 px-3.5 sm:px-8 pb-6 sm:pb-8">
          <div className="space-y-6 sm:space-y-8">
            {/* Score Summary */}
            <div className="text-center">
              <div className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white mb-1">
                <span className="text-indigo-600 dark:text-indigo-400">{results.score}</span> / {total}
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300 mb-3">
                {pct.toFixed(1)}%
              </div>
              <Progress value={pct} className="h-2.5 max-w-md mx-auto" />
            </div>

            {/* Detailed Results */}
            <div className="space-y-3 sm:space-y-4">
              {rawQuestions.map((result: any, index: number) => {
                const questionText = result.question || `Question ${index + 1}`;
                const yourAns = result.yourAnswer !== undefined
                  ? result.yourAnswer
                  : (result.userAnswer !== undefined && result.options ? (result.userAnswer === -1 ? 'Not Attempted' : result.options[result.userAnswer]) : 'Not Attempted');
                const correctAns = result.correctAnswer !== undefined
                  ? (typeof result.correctAnswer === 'number' && result.options ? result.options[result.correctAnswer] : String(result.correctAnswer))
                  : 'N/A';
                const isCorr = result.isCorrect !== undefined
                  ? result.isCorrect
                  : (result.userAnswer === result.correctAnswer);

                return (
                  <div key={index} className="p-3.5 sm:p-5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50">
                    <div className="space-y-3">
                      <div className="font-bold text-sm sm:text-base text-gray-900 dark:text-white leading-snug">
                        <FormattedHeader text={questionText} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div className="p-2.5 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Your Answer</div>
                          <div className={`font-semibold mt-0.5 ${isCorr ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {yourAns}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Correct Answer</div>
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {correctAns}
                          </div>
                        </div>
                      </div>
                      {result.explanation && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-neutral-900 p-2.5 sm:p-3 rounded-lg border border-gray-200 dark:border-neutral-800">
                          <div className="font-bold uppercase text-[10px] text-gray-400 mb-0.5">Explanation:</div>
                          {result.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs font-bold">
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  router.push(`/dashboard`);
                }}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 