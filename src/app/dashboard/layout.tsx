'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import Loading from '../loading';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isRedirecting, setIsRedirecting] = useState(false);
   useEffect(() => {
    if (status === "unauthenticated") {
      setIsRedirecting(true);
      router.push("/auth/signin");
    }
  }, [status, router]);

  if (status === 'loading'|| isRedirecting) {
    return <div><Loading /></div>;
  }


  return (
    <div>
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold">MCQ Test Platform</h1>
              <Button
                variant="ghost"
                onClick={() => router.push('/dashboard')}
              >
                Dashboard
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push('/create-test')}
              >
                Create Test
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <span>{session?.user?.name}</span>
              <Button variant="outline" onClick={() => signOut()}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
} 