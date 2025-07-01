'use client';

import React, { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@radix-ui/themes';
import { Flex, Text } from '@radix-ui/themes';
import { toast } from 'sonner';
import { redirect } from 'next/navigation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession()
  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null);
  const COOLDOWN_MS = 5000;
  

  useEffect(() => {
    if (session) {
      redirect("/dashboard")
    }
  },[session])

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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      console.log(response)
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Login failed')
      }
   
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      console.log(result)

      if (result?.error) {
        toast.error('Authentication failed: Invalid credentials.');
      } else {
        redirect('/dashboard')
      }
    }catch (error) {
      const message =
      error instanceof Error ? error.message : 'An unexpected error occurred during login.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center">Welcome Back</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSignIn} className="space-y-4">
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
            <Button type="submit" className="w-full bg-black text-white p-2 rounded font-semibold hover:bg-slate-200 hover:text-black backdrop-hue-rotate-15 " disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

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
            onClick={() => signIn('google', { callbackUrl: 'http://localhost:3000/dashboard' })}
          >
            Sign in with Google
          </Button>

          <Flex justify="center" mt="4">
            <Text size="2">
              Don't have an account?{' - '}
              <a  href="/auth/signup" className="text-black-600 font-semibold text-md hover:underline hover:text-blue-800">
                Sign up
              </a>
            </Text>
          </Flex>
        </CardContent>
      </Card>
    </div>
  );
} 