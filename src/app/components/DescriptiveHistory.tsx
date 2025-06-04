'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { LoadingSpinner } from './LoadingSpinner';

interface TestHistory {
  _id: string;
  examName: string;
  question: string;
  answer: string;
  wordCount: number;
  timeTaken: number;
  score: number;
  feedback: string;
  strengths: string[];
  areasToImprove: string[];
  suggestions: string[];
  improvedAnswer?: string;
  createdAt: string;
}

export default function DescriptiveHistory() {
  const [tests, setTests] = useState<TestHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState<TestHistory | null>(null);
  const [showImprovement, setShowImprovement] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [testToDelete, setTestToDelete] = useState<TestHistory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const response = await fetch('/api/descriptive/history');
      const data = await response.json();
      if (data.success) {
        setTests(data.tests);
      }
    } catch (error) {
      toast.error('Failed to fetch test history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (test: TestHistory) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/descriptive/${test._id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setTests(tests.filter(t => t._id !== test._id));
        toast.success('Test deleted successfully');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error('Failed to delete test');
    } finally {
      setIsDeleting(false);
      setTestToDelete(null);
    }
  };

  const handleImproveAnswer = async (test: TestHistory) => {
    setIsImproving(true);
    try {
      const response = await fetch('/api/descriptive/improve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: test.question,
          answer: test.answer,
          examName: test.examName,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSelectedTest({ ...test, improvedAnswer: data.improvedAnswer });
        setShowImprovement(true);
      }
    } catch (error) {
      toast.error('Failed to improve answer');
    } finally {
      setIsImproving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const highlightDifferences = (original: string, improved: string) => {
    const originalWords = original.split(/\s+/);
    const improvedWords = improved.split(/\s+/);
    const result: JSX.Element[] = [];
    let i = 0;
    let j = 0;

    while (i < originalWords.length || j < improvedWords.length) {
      if (i < originalWords.length && j < improvedWords.length && originalWords[i] === improvedWords[j]) {
        result.push(<span key={`same-${i}`}>{originalWords[i]} </span>);
        i++;
        j++;
      } else {
        if (i < originalWords.length) {
          result.push(
            <span key={`removed-${i}`} className="line-through text-red-500">
              {originalWords[i]}{' '}
            </span>
          );
          i++;
        }
        if (j < improvedWords.length) {
          result.push(
            <span key={`added-${j}`} className="text-green-500">
              {improvedWords[j]}{' '}
            </span>
          );
          j++;
        }
      }
    }

    return result;
  };

  if (isLoading) {
    return <div><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-4">
      {tests.length === 0 ? (
        <div>No tests found</div>
      ) : (
        tests.map((test) => (
          <Card key={test._id} className="mb-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{test.examName}</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-500">
                    {formatDate(test.createdAt)}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setTestToDelete(test)}
                    disabled={isDeleting}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold">Question</h3>
                <p>{test.question}</p>
              </div>
              <div>
                <h3 className="font-semibold">Your Answer</h3>
                <p className="whitespace-pre-wrap">{test.answer}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Score</h3>
                  <p className="text-2xl font-bold">{test.score}/100</p>
                </div>
                <div>
                  <h3 className="font-semibold">Word Count</h3>
                  <p className="text-2xl font-bold">{test.wordCount}</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold">Feedback</h3>
                <p>{test.feedback}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => handleImproveAnswer(test)}
                  disabled={isImproving}
                >
                  {isImproving ? 'Improving...' : 'Get Improved Answer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={showImprovement} onOpenChange={setShowImprovement}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Improved Answer</DialogTitle>
          </DialogHeader>
          {selectedTest && selectedTest.improvedAnswer && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Original Answer</h3>
                <p className="whitespace-pre-wrap">{selectedTest.answer}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Improved Answer</h3>
                <p className="whitespace-pre-wrap">
                  {highlightDifferences(selectedTest.answer, selectedTest.improvedAnswer)}
                </p>
              </div>
              <div className="text-sm text-gray-500">
                <p>Red text: Removed content</p>
                <p>Green text: Added content</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!testToDelete} onOpenChange={() => setTestToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your test and its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => testToDelete && handleDelete(testToDelete)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 