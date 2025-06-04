'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import EditTest from '@/app/components/EditTest';
import { toast } from 'sonner';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface Test {
  _id: string;
  title: string;
  duration: number;
  questions: Question[];
}

export default function EditTestPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [test, setTest] = useState<Test | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const response = await fetch(`/api/tests/${params.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch test');
        }
        const data = await response.json();
        setTest(data.test);
      } catch (error) {
        console.error('Error fetching test:', error);
        toast.error('Failed to load test');
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTest();
  }, [params.id, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Test not found</div>
      </div>
    );
  }

  return <EditTest testId={test._id} initialData={test} />;
} 