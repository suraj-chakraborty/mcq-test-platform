'use client';

import React, { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@radix-ui/themes';
import { Flex, Text } from '@radix-ui/themes';
import { toast } from 'sonner';
import { redirect, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Chrome, ArrowRight, Loader2 } from 'lucide-react';
import { LoadingSpinner as Loading } from '../../components/LoadingSpinner';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null);
  const COOLDOWN_MS = 5000;

  useEffect(() => {
    if (status === 'authenticated') {
      router.push("/dashboard");
    }
  }, [status, router]);

  const handleManualSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    const now = Date.now();
    if (lastAttemptTime && now - lastAttemptTime < COOLDOWN_MS) {
      toast.error(`Please wait ${Math.ceil((COOLDOWN_MS - (now - lastAttemptTime)) / 1000)}s before retrying.`);
      return;
    }

    setLastAttemptTime(now);
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error(result.error || 'Invalid credentials.');
        setLoading(false);
      } else {
        toast.success('Welcome back!');
        router.push('/dashboard');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred during login.');
      setLoading(false);
    }
  };

  const handleSocialSignIn = (provider: string) => {
    setLoading(true);
    signIn(provider, { callbackUrl: window.location.origin + '/dashboard' });
  };

  if (status === 'loading') {
    return <Loading />;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white relative">
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
          >
            <Loading />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Decorative Elements (Right Side Visuals - Sticky on Desktop) */}
      <div className="hidden lg:flex lg:flex-1 relative bg-slate-900 overflow-hidden sticky top-0 h-screen">
        <img src="/auth_edu_background.png" alt="Education Background" className="absolute inset-0 w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40" />

        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 xl:p-12 text-center z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="h-24 w-24 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-white/20 p-3.5"
          >
            <img src="/logo.png" alt="MCQ Test Platform Logo" className="w-full h-full object-contain" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl xl:text-4xl font-black text-white mb-3 tracking-tight"
          >
            Master Your Future
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-sm xl:text-base text-indigo-100/80 font-medium max-w-md"
          >
            Join thousands of students and professionals who are leveling up their skills through our advanced MCQ platform.
          </motion.p>
        </div>
      </div>

      {/* Auth Content (Left Side - Responsive Scrollable Form) */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full lg:w-[50%] xl:w-[45%] flex flex-col min-h-screen overflow-y-auto justify-center px-4 sm:px-8 md:px-12 lg:px-8 xl:px-14 py-6 sm:py-10"
      >
        <div className="w-full max-w-md mx-auto my-auto space-y-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-4"
          >
            <div className="lg:hidden flex items-center justify-center gap-2.5 mb-5">
              <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-md p-1.5 border border-gray-100">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-xl font-black text-gray-900 tracking-tight">
                MCQ <span className="text-indigo-600">Platform</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-1">
              Welcome Back
            </h1>
            <p className="text-gray-500 font-medium text-xs sm:text-sm">
              Sign in to continue your assessment journey
            </p>
          </motion.div>

          <form onSubmit={handleManualSignIn} className="space-y-3">
            <motion.div
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-1"
            >
              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 ml-0.5">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-xl transition-all outline-none font-medium text-gray-900 text-xs sm:text-sm"
                  required
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-1"
            >
              <div className="flex justify-between items-center px-0.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Password
                </label>
                <button type="button" className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700">
                  Forgot?
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-xl transition-all outline-none font-medium text-gray-900 text-xs sm:text-sm"
                  required
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="pt-1.5"
            >
              <button
                type="submit"
                className="w-full h-11 sm:h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl font-black text-sm sm:text-base shadow-md shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 group disabled:opacity-70 cursor-pointer"
                disabled={loading}
              >
                {loading ? (
                  "Signing In..."
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </motion.div>
          </form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="relative my-3 sm:my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <span className="px-3 bg-white text-gray-400">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              className="w-full h-10 sm:h-11 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2.5 shadow-sm group text-xs sm:text-sm cursor-pointer"
              onClick={() => handleSocialSignIn('google')}
            >
              <Chrome className="h-4 w-4 text-red-500 group-hover:scale-110 transition-transform" />
              <span>Continue with Google</span>
            </button>

            <div className="text-center mt-3 sm:mt-4">
              <p className="text-gray-500 font-medium text-xs sm:text-sm">
                New here?{' '}
                <a href="/auth/signup" className="text-indigo-600 font-black hover:text-indigo-700 transition-colors inline-flex items-center gap-0.5 group">
                  Create free account
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
