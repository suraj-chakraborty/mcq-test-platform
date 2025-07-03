'use client';
import { redirect } from 'next/navigation';
import { useRouter } from 'next/router';
import { useState } from 'react';

interface Props {
  email: string;
}

export default function OTPVerificationForm({ email }: Props) {
  const [otp, setOtp] = useState('');
  const router = useRouter();

  const handleVerify = async () => {
    try {
      const res = await fetch('/api/Verify-Otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Email verified successfully!');
        router.push('/auth/signin')
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('OTP verification failed');
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Enter OTP</h3>
      <p className='font-bold text-sm bg-gray-500' >check your Gmail for OTP</p>
      <input
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="Enter OTP"
        className="w-full border p-2"
      />
      <button onClick={handleVerify} className="bg-green-600 text-white px-4 py-2 rounded">
        Verify OTP
      </button>
    </div>
  );
}
