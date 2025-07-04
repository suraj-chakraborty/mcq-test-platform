'use client';

import React, { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@radix-ui/themes';
import { Flex, Text } from '@radix-ui/themes';
import { toast } from 'sonner';
import { signIn } from 'next-auth/react';
import { redirect } from 'next/navigation';
import OTPVerificationForm from '@/app/components/OTPVerificationForm';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);

  const handleManualSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json()
      if (response.ok) {
        alert('OTP sent to your email');
        setShowOTP(true);
      } else {
         throw new Error(data.message || 'Registration failed')
      }

      // Sign in after successful registration
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      // if (result?.error) {
      //   toast.error('Failed to sign in after registration');
      // } else {
      //   redirect('/dashboard')
      // }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center">Create an Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSignUp} className="space-y-4">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            />
            <Button type="submit" className="w-full bg-black text-white p-2 rounded font-semibold hover:bg-slate-200 hover:text-black backdrop-hue-rotate-15" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
          </form>
            {showOTP && <OTPVerificationForm email={email} />}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <Button
            className="w-full cursor-pointer bg-white text-black p-2 rounded font-semibold hover:bg-gray-100 hover:text-black backdrop-hue-rotate-15"
            onClick={() => signIn('google', { callbackUrl: 'https://mcq-test-platform.netlify.app/dashboard' })}
          >
            Sign up with Google
          </Button>

          <Flex justify="center" mt="4">
            <Text size="2">
              Already have an account?{' '}
              <a href="/auth/signin" className="text-black-600 font-semibold text-md hover:underline hover:text-blue-800">
                Sign in
              </a>
            </Text>
          </Flex>
        </CardContent>
      </Card>
    </div>
  );
} 