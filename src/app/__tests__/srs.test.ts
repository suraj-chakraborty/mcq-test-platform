import { calculateSM2 } from '../lib/srs';

describe('SRS Algorithm (SM-2)', () => {
  const initialStats = { interval: 0, repetition: 0, easeFactor: 2.5 };

  it('should initialize correctly for a new card (quality 4)', () => {
    const { interval, repetition, easeFactor } = calculateSM2(4, initialStats);
    expect(repetition).toBe(1);
    expect(interval).toBe(1);
    expect(easeFactor).toBe(2.5);
  });

  it('should increment interval to 6 for the second correct repetition', () => {
    const stats = { interval: 1, repetition: 1, easeFactor: 2.5 };
    const { interval, repetition } = calculateSM2(5, stats);
    expect(repetition).toBe(2);
    // 6 fuzz (±1) = [5, 7]
    expect(interval).toBeGreaterThanOrEqual(5);
    expect(interval).toBeLessThanOrEqual(7);
  });

  it('should calculate intervals correctly for advanced repetitions', () => {
    const stats = { interval: 6, repetition: 2, easeFactor: 2.5 };
    const { interval, repetition } = calculateSM2(5, stats);
    expect(repetition).toBe(3);
    // 6 * 2.5 = 15. Due to fuzzing (±5%), it should be within [14, 16]
    expect(interval).toBeGreaterThanOrEqual(14);
    expect(interval).toBeLessThanOrEqual(16);
  });

  it('should reset repetition and interval for poor quality (quality < 3)', () => {
    const stats = { interval: 30, repetition: 5, easeFactor: 2.7 };
    const { interval, repetition } = calculateSM2(2, stats);
    expect(repetition).toBe(0);
    expect(interval).toBe(1); // SM2 implementation sets it to 1 on lapse
  });
});
