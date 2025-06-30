'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import PDFTestAttempt from '@/app/components/PDFTestAttempt';

export default function AttemptTestPage() {
  const { data: session, status } = useSession();
  const params = useParams()
  const router = useRouter();
  const [test, setTest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const response = await fetch(`/api/pdf-tests/${params.id}`);
        const data = await response.json();
        if (data.success) {
          setTest(data.test);
        }
      } catch (error) {
        console.error('Error fetching test:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchTest();
    }
  }, [session, params.id]);

  if (status === 'loading' || isLoading) {
    return <div>Loading...</div>;
  }

  if (!session || !test) {
    return null;
  }

  return (
    <div className="container mx-auto py-8">
      <PDFTestAttempt test={test} />
    </div>
  );
} 