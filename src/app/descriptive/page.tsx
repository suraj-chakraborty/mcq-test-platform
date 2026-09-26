'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import DescriptiveWriting from '@/app/components/DescriptiveWriting';
import DescriptiveHistory from '@/app/components/DescriptiveHistory';
import { PenTool, History } from 'lucide-react';

export default function DescriptivePage() {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-neutral-800/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Descriptive Writing Practice
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Timed essay & subjective answer practice with speech dictation, timer tracking, and detailed rubric scoring.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="rounded-xl font-bold text-xs h-9 px-4 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200 gap-2 shadow-sm transition-all"
          >
            {showHistory ? (
              <>
                <PenTool className="w-3.5 h-3.5 text-indigo-400" />
                <span>Practice Studio</span>
              </>
            ) : (
              <>
                <History className="w-3.5 h-3.5 text-indigo-400" />
                <span>View History</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {showHistory ? <DescriptiveHistory /> : <DescriptiveWriting />}
    </div>
  );
}