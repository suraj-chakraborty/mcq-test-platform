'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';

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
    results: QuestionResult[];
    attemptId: string;
  };
  onClose: () => void;
}

export default function TestResults({ results, onClose }: TestResultsProps) {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* Score Summary */}
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">
                {results.score}/{results.totalQuestions}
              </div>
              <div className="text-2xl mb-4">
                {results.percentage.toFixed(1)}%
              </div>
              <Progress value={results.percentage} className="h-2" />
            </div>

            {/* Detailed Results */}
            <div className="space-y-6">
              {results.results.map((result, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="font-medium">{result.question}</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">Your Answer</div>
                          <div
                            className={`${
                              result.isCorrect ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {result.yourAnswer}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">
                            Correct Answer
                          </div>
                          <div className="text-green-600">
                            {result.correctAnswer}
                          </div>
                        </div>
                      </div>
                      {result.explanation && (
                        <div className="text-sm text-gray-600">
                          <div className="font-medium">Explanation:</div>
                          {result.explanation}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                onClick={() => {
                  router.push(`/dashboard`);
                }}
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