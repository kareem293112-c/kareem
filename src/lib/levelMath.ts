/**
 * Standard industrial level progression formulas for exponential XP.
 */

export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += Math.floor(Math.pow(i, 3) * 150) + 500;
  }
  return total;
}

export function getLevelFromXp(xp: number): number {
  if (!xp || xp < 0) return 1;
  let level = 1;
  // Use a reasonable limit to prevent any infinite loops, but level can scale high
  while (level < 500) {
    const nextXp = getXpForLevel(level + 1);
    if (xp >= nextXp) {
      level++;
    } else {
      break;
    }
  }
  return level;
}

export function getLevelProgress(xp: number) {
  const currentLvl = getLevelFromXp(xp);
  const nextLvl = currentLvl + 1;
  const minXpForCurrent = getXpForLevel(currentLvl);
  const minXpForNext = getXpForLevel(nextLvl);
  const range = minXpForNext - minXpForCurrent;
  const progressInLevel = xp - minXpForCurrent;
  const progressPercentage = Math.min(100, Math.max(0, (progressInLevel / (range || 1)) * 100));
  const remainingXp = minXpForNext - xp;

  return {
    currentLvl,
    nextLvl,
    minXpForCurrent,
    minXpForNext,
    progressPercentage,
    remainingXp
  };
}
