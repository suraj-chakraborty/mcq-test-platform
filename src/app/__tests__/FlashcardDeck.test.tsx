import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FlashcardDeck from '../components/FlashcardDeck';

jest.mock('sonner');
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, ...props }: any) => <div onClick={onClick} {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

describe('FlashcardDeck Component', () => {
  const mockCards = [
    {
      id: 'fc1',
      question: {
        question: 'What is the speed of light?',
        options: ['3x10^8 m/s', '1.5x10^8 m/s'],
        correctAnswer: 0,
        explanation: 'Speed of light in vacuum is approx 3x10^8 m/s.',
      },
    },
    {
      id: 'fc2',
      question: {
        question: 'What is Newton’s first law?',
        options: ['Law of Inertia', 'Action Reaction'],
        correctAnswer: 0,
        explanation: 'An object remains at rest unless acted upon by a net force.',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  it('renders the first flashcard front side', () => {
    render(<FlashcardDeck cards={mockCards} onComplete={jest.fn()} />);

    expect(screen.getByText('What is the speed of light?')).toBeInTheDocument();
    expect(screen.getByText(/Tap to reveal Answer/i)).toBeInTheDocument();
  });

  it('flips card to reveal answer and confidence rating buttons', async () => {
    render(<FlashcardDeck cards={mockCards} onComplete={jest.fn()} />);

    const card = screen.getByText('What is the speed of light?');
    fireEvent.click(card);

    await waitFor(() => {
      expect(screen.getByText('3x10^8 m/s')).toBeInTheDocument();
      expect(screen.getByText(/Good/i)).toBeInTheDocument();
      expect(screen.getByText(/Perfect/i)).toBeInTheDocument();
    });
  });

  it('submits rating and progresses to next card', async () => {
    const onComplete = jest.fn();
    render(<FlashcardDeck cards={mockCards} onComplete={onComplete} />);

    // Reveal answer
    fireEvent.click(screen.getByText('What is the speed of light?'));

    // Click rating (e.g. Good)
    const goodBtn = await screen.findByRole('button', { name: /Good/i });
    fireEvent.click(goodBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/flashcards/fc1/review', expect.any(Object));
    });
  });
});
