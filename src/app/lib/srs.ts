/**
 * Spaced Repetition System (SRS) using Refined SM-2 Algorithm
 */

interface SRSStats {
  interval: number;
  repetition: number;
  easeFactor: number;
}

/**
 * Calculates the next review stats based on a refined SuperMemo-2 algorithm.
 * @param quality User rating from 0 (forgot) to 5 (perfect).
 * @param currentStats Object containing interval, repetition, and easeFactor.
 * @param lastReviewedAt Optional date of the previous review to calculate delay.
 * @returns Updated SRSStats and the nextReviewAt Date.
 */
export function calculateSM2(
  quality: number, 
  currentStats: SRSStats, 
  lastReviewedAt?: Date
) {
  let { interval, repetition, easeFactor } = currentStats;

  // 1. Calculate Delay Bonus (if late)
  let delayBonus = 1;
  if (lastReviewedAt && quality >= 4) {
    const now = new Date();
    const expected = new Date(lastReviewedAt);
    expected.setDate(expected.getDate() + interval);
    
    const daysLate = Math.max(0, (now.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLate > 0) {
      // Bonus: +10% of the late days for quality 4-5
      delayBonus = 1 + (daysLate * 0.1);
    }
  }

  // 2. Main SM-2 Logic
  if (quality >= 3) {
    // Correct response
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor * delayBonus);
    }
    repetition++;
  } else {
    // Incorrect response (Lapse)
    // Reduce Ease Factor more significantly on lapse
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    repetition = 0;
    interval = 1;
  }

  // 3. Ease Factor Adjustment
  // formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (quality >= 3) {
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  }
  if (easeFactor < 1.3) easeFactor = 1.3;

  // 4. Interval Fuzzing (±5% or at least 1 day for longer intervals)
  // This prevents reviews from "clumping" together on the same day
  if (interval > 2) {
    const fuzz = Math.max(1, Math.round(interval * 0.05));
    const randomFuzz = Math.floor(Math.random() * (fuzz * 2 + 1)) - fuzz;
    interval += randomFuzz;
  }

  // 5. Max Interval Cap (2 Years)
  if (interval > 730) interval = 730;

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);
  nextReviewAt.setHours(0, 0, 0, 0);

  return {
    interval,
    repetition,
    easeFactor,
    nextReviewAt
  };
}
