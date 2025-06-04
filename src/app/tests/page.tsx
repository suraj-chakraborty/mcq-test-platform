'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
}

interface PDF {
  _id: string;
  title: string;
}

export default function TestsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [selectedPdfs, setSelectedPdfs] = useState<string[]>([]);
  const [testType, setTestType] = useState<'pdf' | 'general' | 'current_affairs'>('pdf');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }

    fetchUserPdfs();
  }, [session, router]);

  const fetchUserPdfs = async () => {
    try {
      const res = await fetch('/api/pdfs');
      const data = await res.json();
      setPdfs(data.pdfs);
    } catch (error) {
      console.error('Error fetching PDFs:', error);
    }
  };

  const handleStartTest = async () => {
    if (testType === 'pdf' && selectedPdfs.length === 0) {
      setError('Please select at least one PDF');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/tests/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testType,
          pdfIds: selectedPdfs,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      router.push(`/tests/${data.id}`);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An error occurred while starting the test');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Take a Test</h1>

      <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Test Type
          </label>
          <select
            value={testType}
            onChange={(e) => setTestType(e.target.value as 'pdf' | 'general' | 'current_affairs')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="pdf">PDF-based Test</option>
            <option value="general">General Knowledge</option>
            <option value="current_affairs">Current Affairs</option>
          </select>
        </div>

        {testType === 'pdf' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select PDFs
            </label>
            <div className="space-y-2">
              {pdfs.map((pdf) => (
                <div key={pdf._id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={pdf._id}
                    value={pdf._id}
                    checked={selectedPdfs.includes(pdf._id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPdfs([...selectedPdfs, pdf._id]);
                      } else {
                        setSelectedPdfs(selectedPdfs.filter(id => id !== pdf._id));
                      }
                    }}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor={pdf._id} className="ml-2 block text-sm text-gray-900">
                    {pdf.title}
                  </label>
                </div>
              ))}
              {pdfs.length === 0 && (
                <p className="text-gray-500">No PDFs available. Upload some first!</p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleStartTest}
          disabled={loading || (testType === 'pdf' && selectedPdfs.length === 0)}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            loading || (testType === 'pdf' && selectedPdfs.length === 0)
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
        >
          {loading ? 'Starting Test...' : 'Start Test'}
        </button>
      </div>
    </div>
  );
} 