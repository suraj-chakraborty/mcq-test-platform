import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '../dashboard/page';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner as Loading } from '../components/LoadingSpinner';

// Mock dependencies
jest.mock('next-auth/react');
jest.mock('next/navigation');
jest.mock('sonner');
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

// Mock child components to simplify dashboard test
jest.mock('@/app/components/PdfUpload', () => () => <div data-testid="pdf-upload" />);
jest.mock('@/app/components/PdfList', () => () => <div data-testid="pdf-list" />);
jest.mock('@/app/components/LoadingSpinner', () => ({ LoadingSpinner: () => <Loading /> }));
jest.mock('@/app/components/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
  TestCardSkeleton: () => <div data-testid="test-card-skeleton" />,
  StatsSkeleton: () => <div data-testid="stats-skeleton" />,
}));

// Mock Radix UI Tabs
jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <button>{children}</button>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));

// Mock Radix UI Select
jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <button>{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <button>{children}</button>,
}));

describe('Dashboard Component', () => {
  const mockPush = jest.fn();
  const mockSession = {
    user: { name: 'Test User', email: 'test@example.com', id: 'user_1' },
    expires: '1'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useSession as jest.Mock).mockReturnValue({ data: mockSession, status: 'authenticated' });

    // Mock global fetch for initial data loading
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/api/tests')) return Promise.resolve({ ok: true, json: async () => ({ tests: [] }) });
      if (url.includes('/api/users/profile')) return Promise.resolve({ ok: true, json: async () => ({ success: true, user: { level: 1, streak: 0, xp: 0, xpInCurrentLevel: 0, xpNeededForNextLevel: 100 } }) });
      if (url.includes('/api/flashcards')) return Promise.resolve({ ok: true, json: async () => ({ success: true, flashcards: [] }) });
      if (url.includes('/api/tests/attempts')) return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
      if (url.includes('/api/pdf-tests')) return Promise.resolve({ ok: true, json: async () => ({ success: true, tests: [] }) });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('renders the dashboard with user name', async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Test User/i)).toBeInTheDocument();
      expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders tabs correctly', async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Normal Test/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Study/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /PDF Management/i })).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('filters tests based on search input', async () => {
    const mockTests = [
      { id: '1', title: 'Math Test', questions: [], duration: 10, createdAt: new Date().toISOString() },
      { id: '2', title: 'Science Test', questions: [], duration: 10, createdAt: new Date().toISOString() },
    ];

    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/tests')) return Promise.resolve({ ok: true, json: async () => ({ tests: mockTests }) });
      if (url.includes('/api/users/profile')) return Promise.resolve({ ok: true, json: async () => ({ success: true, user: { level: 1, streak: 0, xp: 0, xpInCurrentLevel: 0, xpNeededForNextLevel: 100 } }) });
      return Promise.resolve({ ok: true, json: async () => ({ success: true, tests: [], flashcards: [], data: [] }) });
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Math Test/i)).toBeInTheDocument();
      expect(screen.getByText(/Science Test/i)).toBeInTheDocument();
    }, { timeout: 4000 });

    const searchInput = screen.getByPlaceholderText(/Search your tests/i);
    fireEvent.change(searchInput, { target: { value: 'Math' } });
    fireEvent.input(searchInput, { target: { value: 'Math' } });

    await waitFor(() => {
      expect(screen.getByText(/Math Test/i)).toBeInTheDocument();
      expect(screen.queryByText(/Science Test/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
