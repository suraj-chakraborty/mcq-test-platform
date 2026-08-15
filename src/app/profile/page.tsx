'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/app/components/Navbar';
import UserProfile from '@/app/components/UserProfile';
import { ArrowLeft, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-gray-900 dark:text-white pb-16">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Top Header & Breadcrumbs */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/dashboard')}
              className="h-9 w-9 rounded-lg border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 shadow-sm"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                Learner Profile & Analytics
              </h1>
              <p className="text-xs text-gray-500 font-medium">
                Comprehensive study metrics, level mastery, achievement badges, and account controls
              </p>
            </div>
          </div>
        </div>

        {/* Profile Card Container */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-6 sm:p-8 shadow-sm">
          <UserProfile />
        </div>
      </main>
    </div>
  );
}
