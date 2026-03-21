import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignIn from '../auth/signin/page';
import SignUp from '../auth/signup/page';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Mocking dependencies
jest.mock('next-auth/react');
jest.mock('next/navigation');
jest.mock('sonner');
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

describe('Auth Pages UI', () => {
  const mockPush = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush });

  describe('SignIn Page', () => {
    beforeEach(() => {
      (useSession as jest.Mock).mockReturnValue({ data: null, status: 'unauthenticated' });
    });

    it('renders sign-in form correctly', () => {
      render(<SignIn />);
      expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument();
    });

    it('handles input changes', () => {
      render(<SignIn />);
      const emailInput = screen.getByPlaceholderText('name@example.com') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      expect(emailInput.value).toBe('test@example.com');
    });

    it('redirects to dashboard if already authenticated', () => {
      (useSession as jest.Mock).mockReturnValue({ data: {}, status: 'authenticated' });
      render(<SignIn />);
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('SignUp Page', () => {
    it('renders sign-up form correctly', () => {
      render(<SignUp />);
      expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Sign Up$/i })).toBeInTheDocument();
    });

    it('shows OTP form after successful internal registration', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'OTP sent' }),
      });

      render(<SignUp />);
      fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'Test User' } });
      fireEvent.change(screen.getByPlaceholderText('name@example.com'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });
      
      fireEvent.click(screen.getByRole('button', { name: /^Sign Up$/i }));

      await waitFor(() => {
        expect(screen.getByText(/Verify Email/i)).toBeInTheDocument();
      });
    });
  });
});
