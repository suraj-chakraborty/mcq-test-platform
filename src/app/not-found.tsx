'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Search, ArrowLeft, Brain } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="mb-8 flex justify-center relative">
          <div className="h-28 w-28 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200 animate-pulse">
            <Brain className="h-14 w-14 text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-slate-100">
            <Search className="h-6 w-6 text-indigo-600" />
          </div>
        </div>

        <h1 className="text-6xl font-black text-slate-900 mb-2 tracking-tighter">
          404
        </h1>
        <h2 className="text-2xl font-black text-slate-800 mb-4">
          Page Not Found
        </h2>
        <p className="text-slate-500 font-medium mb-10 leading-relaxed">
          Oops! The test or page you're searching for seems to have vanished into thin air. Let's get you back on track.
        </p>

        <Link href="/dashboard">
          <Button
            className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 group"
          >
            <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}