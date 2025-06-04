'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import DescriptiveWriting from '@/app/components/DescriptiveWriting';
import DescriptiveHistory from '@/app/components/DescriptiveHistory';

export default function DescriptivePage() {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Descriptive Writing Practice</h1>
        <Button onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? 'Start New Test' : 'View History'}
        </Button>
      </div>

      {showHistory ? <DescriptiveHistory /> : <DescriptiveWriting />}
    </div>
  );
} 