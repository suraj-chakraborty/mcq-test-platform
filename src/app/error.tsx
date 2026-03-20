'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="mb-8 flex justify-center">
          <div className="h-24 w-24 bg-rose-100 rounded-[2rem] flex items-center justify-center shadow-xl shadow-rose-100/50">
            <AlertTriangle className="h-12 w-12 text-rose-600" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">
          Something went wrong
        </h1>
        <p className="text-slate-500 font-medium mb-10 leading-relaxed">
          We encountered an unexpected error. This might be due to a temporary server issue or maintenance. Please try again or return home.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => reset()}
            className="h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCcw className="h-5 w-5" />
            Try Again
          </Button>
          
          <Link href="/">
            <Button
              variant="ghost"
              className="w-full h-14 text-slate-500 hover:text-slate-900 font-bold hover:bg-slate-100 rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <Home className="h-5 w-5" />
              Back to Home
            </Button>
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-slate-900 rounded-2xl text-left overflow-auto max-h-40">
            <pre className="text-[10px] text-rose-400 font-mono">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </div>
        )}
      </motion.div>
    </div>
  );
}