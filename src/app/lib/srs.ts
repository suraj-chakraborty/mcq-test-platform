/**
 * Spaced Repetition System (SRS) using SM-2 Algorithm
 */

interface SRSStats {
  interval: number;
  repetition: number;
  easeFactor: number;
}

/**
 * Calculates the next review stats based on the SuperMemo-2 algorithm.
 * @param quality User rating from 0 (forgot) to 5 (perfect).
 * @param currentStats Object containing interval, repetition, and easeFactor.
 * @returns Updated SRSStats and the nextReviewAt Date.
 */
export function calculateSM2(quality: number, currentStats: SRSStats) {
  let { interval, repetition, easeFactor } = currentStats;

  if (quality >= 3) {
    // Correct response
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetition++;
  } else {
    // Incorrect response
    repetition = 0;
    interval = 1;
  }

  // Calculate new Ease Factor
  // easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);
  nextReviewAt.setHours(0, 0, 0, 0); // Start of the day

  return {
    interval,
    repetition,
    easeFactor,
    nextReviewAt
  };
}
