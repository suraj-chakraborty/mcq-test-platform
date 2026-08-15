import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Navbar from '../components/Navbar';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

jest.mock('next-auth/react');
jest.mock('next/navigation');
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

describe('Navbar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
  });

  it('renders brand logo and public navigation when unauthenticated', () => {
    (useSession as jest.Mock).mockReturnValue({ data: null, status: 'unauthenticated' });

    render(<Navbar />);

    expect(screen.getByText(/MCQ/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign In/i)).toBeInTheDocument();
  });

  it('renders navigation links and user profile trigger when authenticated', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { name: 'Test User', email: 'test@example.com', image: null } },
      status: 'authenticated',
    });

    render(<Navbar />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Upload PDF')).toBeInTheDocument();
    expect(screen.getByText('Explore Tests')).toBeInTheDocument();
    expect(screen.getByText('AI Studio')).toBeInTheDocument();
  });

  it('toggles mobile menu on mobile button click', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { name: 'Test User' } },
      status: 'authenticated',
    });

    render(<Navbar />);

    // Click mobile menu button
    const mobileButton = screen.getByRole('button', { name: /Toggle Menu/i });
    fireEvent.click(mobileButton);

    // Profile & Settings link should now be in DOM
    expect(screen.getAllByText(/Settings/i)[0]).toBeInTheDocument();
  });
});
