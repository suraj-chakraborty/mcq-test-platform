'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@radix-ui/themes';
import { LoadingSpinner as Loading } from './LoadingSpinner';


interface Props {
  email: string;
}


export default function OTPVerificationForm({ email }: Props) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleVerify = async () => {
    if (!otp) {
      toast.error('Please enter the OTP');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/Verify-Otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Email verified successfully!');
        router.push('/auth/signin');
      } else {
        toast.error(data.message || 'Invalid OTP');
        setLoading(false);
      }
    } catch (err) {
      toast.error('OTP verification failed');
      setLoading(false);
    }
  };

  return (
    <>
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Verification Code</label>
          <div className="relative group">
            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit code"
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl transition-all outline-none font-medium text-gray-900"
            />
          </div>
          <p className='text-[10px] font-bold text-gray-400 bg-gray-100/50 py-2 px-3 rounded-lg inline-block' >
            Check your inbox & spam folder
          </p>
        </div>

        <Button
          onClick={handleVerify}
          disabled={loading}
          className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
        >
          {loading ? 'VERIFYING...' : (
            <>
              Verify Account
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </Button>
      </motion.div>
    </>
  );
}
