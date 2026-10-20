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
  /** 答えるたびに貯まる経験値。ランクの基準にする */
  xp: number
}

export const emptyProgress = (): Progress => ({
  grades: { best: 0, correct: 0, inaccuracy: 0, wrong: 0, blunder: 0 },
  streak: 0,
  bestStreak: 0,
  today: { date: '', count: 0 },
  xp: 0,
})

const isGood = (grade: Grade) => grade === 'best' || grade === 'correct'

const BASE_XP: Record<Grade, number> = { best: 10, correct: 7, inaccuracy: 3, wrong: 1, blunder: 0 }
const MAX_STREAK_BONUS = 10

/**
 * 1問で得る経験値。外しても少しは入るようにして、間違えることを罰にしない。
 * 連続正解の長さだけ上乗せし、続けて当てることに意味を持たせる
 */
export function xpFor(grade: Grade, streakAfter: number): number {
  return BASE_XP[grade] + (isGood(grade) ? Math.min(streakAfter, MAX_STREAK_BONUS) : 0)
}

export const RANKS = [
  { name: 'ブロンズ', from: 0 },
  { name: 'シルバー', from: 200 },
  { name: 'ゴールド', from: 600 },
  { name: 'プラチナ', from: 1500 },
  { name: 'ダイヤモンド', from: 3000 },
  { name: 'マスター', from: 6000 },
] as const

export interface RankInfo {
  name: string
  /** 次のランクまでの進み具合（0〜1）。最上位なら 1 */
  progress: number
  /** 次のランクの名前と、それまでに要る経験値。最上位なら null */
  next: { name: string; remaining: number } | null
}

export function rankOf(xp: number): RankInfo {
  const index = RANKS.findLastIndex((rank) => xp >= rank.from)
  const current = RANKS[index]
  const next = RANKS[index + 1]
  if (!next) return { name: current.name, progress: 1, next: null }
  return {
    name: current.name,
    progress: (xp - current.from) / (next.from - current.from),
    next: { name: next.name, remaining: next.from - xp },
  }
}

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
    xp: (progress.xp ?? 0) + xpFor(grade, streak),
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
    xp: value.xp ?? 0,
  }
}
