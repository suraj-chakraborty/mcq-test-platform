'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import DescriptiveWriting from '@/app/components/DescriptiveWriting';
import DescriptiveHistory from '@/app/components/DescriptiveHistory';
import { PenTool, History } from 'lucide-react';

export default function DescriptivePage() {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-neutral-800/80">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
            <PenTool className="w-3.5 h-3.5 text-indigo-400" />
            <span>Descriptive Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Descriptive Writing Practice
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-neutral-400 mt-1">
            AI-evaluated essay & answer writing with real-time speech dictation, timer tracking, and detailed rubric scoring.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="rounded-xl font-bold text-xs h-9 px-4 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-indigo-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200 gap-2 shadow-sm transition-all"
          >
            {showHistory ? (
              <>
                <PenTool className="w-3.5 h-3.5 text-indigo-500" />
                <span>Practice Studio</span>
              </>
            ) : (
              <>
                <History className="w-3.5 h-3.5 text-indigo-500" />
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