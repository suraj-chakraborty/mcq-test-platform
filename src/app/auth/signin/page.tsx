'use client';

import React, { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@radix-ui/themes';
import { Flex, Text } from '@radix-ui/themes';
import { toast } from 'sonner';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession()

  const handleManualSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Login failed');
      }

      // Sign in after successful registration
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed');
    }
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Invalid credentials');
      } else {
        window.location.href = '/dashboard';
      }
    } catch (error) {
      toast.error('An error occurred');
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
            <Button type="submit" className="w-full" disabled={loading}>
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
            className="w-full"
            onClick={() => signIn('google', { callbackUrl: 'http://localhost:3000/dashboard' })}
          >
            Sign in with Google
          </Button>

          <Flex justify="center" mt="4">
            <Text size="2">
              Don't have an account?{' '}
              <a href="/auth/signup" className="text-blue-600 hover:underline">
                Sign up
              </a>
            </Text>
          </Flex>
        </CardContent>
      </Card>
    </div>
  );
} 