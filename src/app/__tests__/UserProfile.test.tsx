import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import UserProfile from '../components/UserProfile';
import { useSession } from 'next-auth/react';

jest.mock('next-auth/react');
jest.mock('sonner');
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

describe('UserProfile Component', () => {
  const mockUser = {
    id: 'u1',
    name: 'Suraj Chakraborty',
    email: 'suraj@example.com',
    level: 3,
    xp: 450,
    totalXp: 450,
    xpInCurrentLevel: 50,
    xpNeededForNextLevel: 100,
    streak: 4,
    totalAttempts: 20,
    avgScore: 85,
    isVerified: true,
    _count: { tests: 12, attempts: 20, flashcards: 35, descriptiveTests: 5, hostedDuels: 2 },
    attempts: [
      { id: 'att1', score: 10, createdAt: new Date().toISOString(), test: { title: 'Modern History' } },
    ],
    achievements: [
      { id: 'ach1', name: 'Speed Demon', description: 'Fast finish', icon: '⚡', unlockedAt: new Date().toISOString() },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { name: 'Suraj Chakraborty', email: 'suraj@example.com' } },
      status: 'authenticated',
    });

    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/api/users/profile')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, user: mockUser }),
        });
      }
      return Promise.reject(new Error('Unknown'));
    });
  });

  it('renders user profile with name, level, and XP stats', async () => {
    render(<UserProfile />);

    await waitFor(() => {
      expect(screen.getByText('Suraj Chakraborty')).toBeInTheDocument();
      expect(screen.getByText('suraj@example.com')).toBeInTheDocument();
      expect(screen.getAllByText(/Level 3/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/4 Day Streak/i)).toBeInTheDocument();
    });
  });

  it('renders achievements and recent activity', async () => {
    render(<UserProfile />);

    await waitFor(() => {
      expect(screen.getByText('Speed Demon')).toBeInTheDocument();
      expect(screen.getByText('Fast finish')).toBeInTheDocument();
    });
  });
});
