import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TestAttempt from '../components/TestAttempt';
import TestResults from '../components/TestResults';
import { useRouter } from 'next/navigation';

// Mock dependencies
jest.mock('next/navigation');
jest.mock('sonner');
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

describe('Test Experience UI', () => {
  const mockTest = {
    id: 'test_1',
    title: 'Sample Test',
    duration: 1,
    description: 'A test description',
    questions: [
      { id: 'q1', question: 'What is 1+1?', options: ['1','2','3','4'], correctAnswer: 1, explanation: 'Basic math', difficulty: 'easy' as const },
      { id: 'q2', question: 'What is 2+2?', options: ['1','2','3','4'], correctAnswer: 3, explanation: 'Basic math', difficulty: 'easy' as const },
    ],
  };

  describe('TestAttempt Component', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('renders the first question and timer', () => {
      render(<TestAttempt test={mockTest} onComplete={jest.fn()} />);
      expect(screen.getByText('What is 1+1?')).toBeInTheDocument();
      expect(screen.getByText(/Time Left: 1:00/)).toBeInTheDocument();
    });

    it('navigates to the next question', () => {
      render(<TestAttempt test={mockTest} onComplete={jest.fn()} />);
      fireEvent.click(screen.getByText('NEXT QUESTION'));
      expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
    });

    it('submits the test automatically when timer hits zero', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, attempt: { score: 1 } }),
      });

      render(<TestAttempt test={mockTest} onComplete={jest.fn()} />);
      
      act(() => {
        jest.advanceTimersByTime(60000); // 1 minute
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/tests/submit', expect.any(Object));
      });
    });
  });

  describe('TestResults Component', () => {
    const mockResults = {
      score: 1,
      totalQuestions: 2,
      percentage: 50,
      results: [
        { question: 'Q1', yourAnswer: '2', correctAnswer: '2', isCorrect: true, explanation: 'Good' },
        { question: 'Q2', yourAnswer: '3', correctAnswer: '4', isCorrect: false, explanation: 'Try again' },
      ],
      attemptId: 'a1',
    };

    it('renders score and percentage', () => {
      render(<TestResults results={mockResults} onClose={jest.fn()} />);
      expect(screen.getByText('1/2')).toBeInTheDocument();
      expect(screen.getByText('50.0%')).toBeInTheDocument();
      expect(screen.getByText('Q1')).toBeInTheDocument();
    });
  });
});
