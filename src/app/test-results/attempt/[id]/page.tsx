'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

interface TestResult {
  id: string;
  userId: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  score: number;
  createdAt: string;
  updatedAt: string;
}

export default function TestResultsPage() {
  const params = useParams();
  const router = useRouter();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        if (!params.attemptId || params.attemptId === 'undefined') {
          toast.error('Invalid test attempt');
          router.push('/dashboard');
          return;
        }
        // console.log("params", params)
        const response = await fetch(`/api/tests/attempts/${params.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch test results');
        }

        const data = await response.json();
        
        // Handle array response - find the specific attempt
        if (Array.isArray(data)) {
          const specificAttempt = data.find(attempt => attempt._id === params.id);
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
  }, [params.attemptId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Test results not found</div>
      </div>
    );
  }

  const percentage = result.score;
  const passed = percentage >= 50; // Assuming passing score is 50%

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-6">Test Results</h1>
          
          <div className="mb-8">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Score</p>
                <p className="text-2xl font-bold">{percentage}%</p>
              </div>
              <div>
                <p className="text-gray-600">Status</p>
                <p className={`text-2xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                  {passed ? 'Passed' : 'Failed'}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-600">Total Questions</p>
                <p className="text-xl font-bold">{result.totalQuestions}</p>
              </div>
              <div>
                <p className="text-gray-600">Correct Answers</p>
                <p className="text-xl font-bold text-green-600">{result.correctAnswers}</p>
              </div>
              <div>
                <p className="text-gray-600">Wrong Answers</p>
                <p className="text-xl font-bold text-red-600">{result.wrongAnswers}</p>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500 mb-8">
            <p>Test taken on: {new Date(result.createdAt).toLocaleString()}</p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 