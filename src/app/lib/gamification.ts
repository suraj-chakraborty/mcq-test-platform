import { prisma } from './prisma';

export const XP_PER_QUESTION = 10;
export const XP_ACCURACY_BONUS = 5; // Extra per correct question
export const LEVEL_UP_BASE = 500; // XP needed for level 1 -> 2
export const LEVEL_UP_MULTIPLIER = 1.2;

/**
 * Calculate XP earned from a test attempt
 */
export function calculateXPEarned(score: number, totalQuestions: number, timeTakenSeconds: number) {
  const baseXP = totalQuestions * XP_PER_QUESTION;
  const accuracyBonus = score * XP_ACCURACY_BONUS;
  
  // Speed bonus: if they finish significantly faster than average (30s per question)
  const averageTime = totalQuestions * 30;
  const speedBonus = timeTakenSeconds < averageTime ? Math.floor((averageTime - timeTakenSeconds) / 10) : 0;

  return baseXP + accuracyBonus + Math.min(speedBonus, 100); // Cap speed bonus at 100
}

/**
 * Determine level based on total XP
 */
export function calculateLevel(totalXP: number) {
  let level = 1;
  let xpNeeded = LEVEL_UP_BASE;
  let currentXP = totalXP;

  while (currentXP >= xpNeeded) {
    currentXP -= xpNeeded;
    level++;
    xpNeeded = Math.floor(xpNeeded * LEVEL_UP_MULTIPLIER);
  }

  return {
    level,
    xpInCurrentLevel: currentXP,
    xpNeededForNextLevel: xpNeeded,
  };
}

/**
 * Handle XP award and achievement check after an attempt
 */
export async function processGamification(userId: string, score: number, totalQuestions: number, timeTakenSeconds: number) {
  const xpEarned = calculateXPEarned(score, totalQuestions, timeTakenSeconds);
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, level: true, achievements: true }
  });

  if (!user) return null;

  const newTotalXP = user.xp + xpEarned;
  const { level: newLevel } = calculateLevel(newTotalXP);
  
  // Check for achievements
  const newAchievements: { name: string; description: string; icon: string }[] = [];
  const existingAchievements = user.achievements.map((a: { name: string }) => a.name);

  // Example Achievements
  if (score === totalQuestions && !existingAchievements.includes('Perfect Score')) {
    newAchievements.push({
      name: 'Perfect Score',
      description: 'Answered all questions correctly in a test.',
      icon: '🎯'
    });
  }

  if (xpEarned > 150 && !existingAchievements.includes('Elite Performance')) {
    newAchievements.push({
      name: 'Elite Performance',
      description: 'Earned more than 150 XP in a single test.',
      icon: '🔥'
    });
  }

  // Update User
  await prisma.user.update({
    where: { id: userId },
    data: {
      xp: newTotalXP,
      level: newLevel,
      lastActivityAt: new Date(),
      achievements: {
        create: newAchievements
      }
    }
  });

  return {
    xpEarned,
    leveledUp: newLevel > user.level,
    newLevel,
    newAchievements
  };
}
