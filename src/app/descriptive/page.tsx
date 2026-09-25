'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import DescriptiveWriting from '@/app/components/DescriptiveWriting';
import DescriptiveHistory from '@/app/components/DescriptiveHistory';

export default function DescriptivePage() {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Descriptive Writing Practice</h1>
        <Button onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? 'Start New Test' : 'View History'}
        </Button>
      </div>

      {showHistory ? <DescriptiveHistory /> : <DescriptiveWriting />}
    </div>
  );
} 