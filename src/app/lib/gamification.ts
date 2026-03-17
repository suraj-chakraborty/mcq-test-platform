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
export async function processGamification(userId: string, score: number, totalQuestions: number, timeTakenSeconds: number, attemptId?: string) {
  const xpEarned = calculateXPEarned(score, totalQuestions, timeTakenSeconds);
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      xp: true, 
      level: true, 
      streak: true, 
      lastActivityAt: true,
      achievements: true 
    }
  });

  if (!user) return null;

  // 1. Update Streak
  const now = new Date();
  let newStreak = user.streak;
  const lastActive = user.lastActivityAt;

  if (!lastActive) {
    newStreak = 1;
  } else {
    const lastDate = new Date(lastActive).setHours(0, 0, 0, 0);
    const todayDate = new Date(now).setHours(0, 0, 0, 0);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      newStreak += 1; // Consecutive day
    } else if (diffDays > 1) {
      newStreak = 1; // Reset streak
    }
  }

  const newTotalXP = user.xp + xpEarned;
  const { level: newLevel } = calculateLevel(newTotalXP);
  
  // 2. Check for achievements
  const newAchievements: { name: string; description: string; icon: string }[] = [];
  const existingAchievements = user.achievements.map((a: { name: string }) => a.name);

  if (score === totalQuestions && !existingAchievements.includes('Perfect Score')) {
    newAchievements.push({ name: 'Perfect Score', description: 'Answered all questions correctly in a test.', icon: '🎯' });
  }

  const averageTimeThreshold = (totalQuestions * 30) * 0.3;
  if (timeTakenSeconds > 0 && timeTakenSeconds < averageTimeThreshold && score >= (totalQuestions * 0.8) && !existingAchievements.includes('Speed Demon')) {
    newAchievements.push({ name: 'Speed Demon', description: 'Finished a test with >80% score in record time.', icon: '⚡' });
  }

  if (newStreak >= 7 && !existingAchievements.includes('Consistency King')) {
    newAchievements.push({ name: 'Consistency King', description: 'Maintained a test streak for 7 consecutive days.', icon: '👑' });
  }

  if (xpEarned > 150 && !existingAchievements.includes('Elite Performance')) {
    newAchievements.push({ name: 'Elite Performance', description: 'Earned more than 150 XP in a single test.', icon: '🔥' });
  }

  // 3. Update User & Attempt
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        xp: newTotalXP,
        level: newLevel,
        streak: newStreak,
        lastActivityAt: now,
        achievements: {
          create: newAchievements
        }
      }
    });

    if (attemptId) {
      await tx.testAttempt.update({
        where: { id: attemptId },
        data: { xpEarned }
      });
    }
  });

  return {
    xpEarned,
    leveledUp: newLevel > user.level,
    newLevel,
    newStreak,
    newAchievements
  };
}
