export const PROGRESS_KEY = 'delta_v_progress';
export const TOTAL_LEVELS = 7;

export function loadProgress() {
  try {
    const data = localStorage.getItem(PROGRESS_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  return { completedLevels: [], unlockedLevel: 1 };
}

export function saveProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function isLevelUnlocked(levelNum) {
  return levelNum <= loadProgress().unlockedLevel;
}

export function markLevelComplete(levelNum) {
  const progress = loadProgress();
  if (!progress.completedLevels.includes(levelNum)) {
    progress.completedLevels.push(levelNum);
  }
  if (levelNum < TOTAL_LEVELS) {
    progress.unlockedLevel = Math.max(progress.unlockedLevel, levelNum + 1);
  }
  saveProgress(progress);
}
