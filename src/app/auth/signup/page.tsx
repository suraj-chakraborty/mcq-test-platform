'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@radix-ui/themes';
import { Flex, Text } from '@radix-ui/themes';
import { toast } from 'sonner';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import OTPVerificationForm from '@/app/components/OTPVerificationForm';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Lock, Chrome, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { LoadingSpinner as Loading } from '@/app/components/LoadingSpinner';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const router = useRouter();

  const handleManualSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Verification code sent to your email');
        setShowOTP(true);
        setLoading(false);
      } else {
        throw new Error(data.message || 'Registration failed');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed');
      setLoading(false);
    }
  };

  const handleSocialSignUp = (provider: string) => {
    setLoading(true);
    signIn(provider, { callbackUrl: window.location.origin + '/dashboard' });
  };

  return (
    <div className="min-h-screen flex bg-white relative overflow-hidden">
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
      {/* Background Decorative Elements (Right Side Visuals) */}
      <div className="hidden lg:block lg:flex-1 relative bg-slate-900 overflow-hidden">
        <img src="/auth_signup_background.png" alt="Education Background" className="absolute inset-0 w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40" />

        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="h-28 w-28 bg-white/10 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl border border-white/20 p-4"
          >
            <img src="/logo.png" alt="MCQ Test Platform Logo" className="w-full h-full object-contain" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-black text-white mb-4"
          >
            Unleash Your Potential
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-indigo-100/80 font-medium max-w-md"
          >
            Create an account today and start your journey towards academic and professional excellence.
          </motion.p>
        </div>
      </div>

      {/* Auth Content (Left Side) */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full lg:max-w-[50%] flex flex-col h-screen overflow-hidden"
      >
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-4">
          <div className="w-full max-w-md mx-auto h-full flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {!showOTP ? (
                <motion.div
                  key="signup-form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col justify-center"
                >
                  <div className="mb-4 text-left">
                    <div className="lg:hidden flex flex-col items-center mb-10">
                      <div className="h-24 w-24 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-2xl p-4 border border-gray-100 transition-transform">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                      </div>
                      <h1 className="text-3xl font-black text-gray-900 tracking-tighter mb-2">MCQ <span className="text-indigo-600">Test Platform</span></h1>
                      <div className="h-1.5 w-16 bg-indigo-600 rounded-full mb-8 opacity-20" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-1">Create Account</h1>
                    <p className="text-gray-500 font-medium text-sm">Join our community of learners</p>
                  </div>

                  <form onSubmit={handleManualSignUp} className="space-y-3">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-1.5"
                    >
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Full Name</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          type="text"
                          placeholder="John Doe"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-[1.25rem] transition-all outline-none font-medium text-gray-900 text-sm"
                          required
                        />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="space-y-1.5"
                    >
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          type="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-[1.25rem] transition-all outline-none font-medium text-gray-900 text-sm"
                          required
                        />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="space-y-1.5"
                    >
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Password</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-[1.25rem] transition-all outline-none font-medium text-gray-900 text-sm"
                          required
                        />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="pt-1"
                    >
                      <Button
                        type="submit"
                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.25rem] font-black text-lg shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
                        disabled={loading}
                      >
                        {loading ? (
                          "Creating Account..."
                        ) : (
                          <>
                            Sign Up
                            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </form>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t-2 border-gray-50"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      <span className="px-4 bg-white text-gray-400">Social Registration</span>
                    </div>
                  </div>

                  <button
                    className="w-full h-14 bg-white border border-gray-100 text-gray-700 rounded-[1.25rem] font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-3 shadow-sm group text-sm"
                    onClick={() => handleSocialSignUp('google')}
                  >
                    <Chrome className="h-5 w-5 text-red-500 group-hover:scale-110 transition-transform" />
                    Sign up with Google
                  </button>

                  <div className="text-center mt-6">
                    <p className="text-gray-500 font-medium text-sm">
                      Already have an account?{' '}
                      <a href="/auth/signin" className="text-indigo-600 font-black hover:text-indigo-700 transition-colors inline-flex items-center gap-0.5 group">
                        Sign in
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </a>
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="otp-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col justify-center"
                >
                  <div className="text-left mb-6">
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Verify Email</h1>
                    <p className="text-gray-500 font-medium text-base">We've sent a code to <span className="text-indigo-600">{email}</span></p>
                  </div>
                  <OTPVerificationForm email={email} />
                  <button
                    onClick={() => setShowOTP(false)}
                    className="w-full mt-8 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1.5 group"
                  >
                    <ArrowRight className="h-3.5 w-3.5 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                    Back to signup
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
