import type { Grade } from './grading'

/** 1日の目標の問題数。続けるきっかけにするため、無理なく届く数にしている */
export const DAILY_GOAL = 20

export interface Progress {
  grades: Record<Grade, number>
  /** Best か Correct が続いている回数 */
  streak: number
  bestStreak: number
  /** 今日（ローカル日付）答えた数 */
  today: { date: string; count: number }
}

export const emptyProgress = (): Progress => ({
  grades: { best: 0, correct: 0, inaccuracy: 0, wrong: 0, blunder: 0 },
  streak: 0,
  bestStreak: 0,
  today: { date: '', count: 0 },
})

const isGood = (grade: Grade) => grade === 'best' || grade === 'correct'

export const localDate = (now: Date) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

export function recordAnswer(progress: Progress, grade: Grade, now = new Date()): Progress {
  const streak = isGood(grade) ? progress.streak + 1 : 0
  const date = localDate(now)
  return {
    grades: { ...progress.grades, [grade]: progress.grades[grade] + 1 },
    streak,
    bestStreak: Math.max(progress.bestStreak, streak),
    today: { date, count: progress.today?.date === date ? progress.today.count + 1 : 1 },
  }
}

/** 今日の分が別の日のものなら0として扱う */
export function todayCount(progress: Progress, now = new Date()): number {
  return progress.today?.date === localDate(now) ? progress.today.count : 0
}

export function accuracy(progress: Progress): number | null {
  const total = Object.values(progress.grades).reduce((sum, n) => sum + n, 0)
  if (total === 0) return null
  return (progress.grades.best + progress.grades.correct) / total
}

/** 以前は採点の内訳だけを保存していたため、その形も読めるようにする */
export function normalizeProgress(saved: unknown): Progress {
  const base = emptyProgress()
  if (typeof saved !== 'object' || saved === null) return base
  const value = saved as Partial<Progress> & Partial<Record<Grade, number>>
  const grades = value.grades ?? (typeof value.best === 'number' ? (value as Record<Grade, number>) : base.grades)
  return {
    grades: { ...base.grades, ...grades },
    streak: value.streak ?? 0,
    bestStreak: value.bestStreak ?? 0,
    today: value.today ?? base.today,
  }
}
