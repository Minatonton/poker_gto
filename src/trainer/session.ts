import type { Grade } from './grading'

/** 1回のチャレンジの問題数。ゲームの1ラウンドのように、区切りでまとめを見せる */
export const SESSION_SIZE = 10

export interface SessionAnswer {
  grade: Grade
  xp: number
}

export interface SessionSummary {
  answered: number
  /** Best か Correct の数 */
  good: number
  xp: number
  /** このチャレンジの中での最長の連続正解 */
  bestStreak: number
  /** S・A・B・C の4段階。全問 Best なら S */
  score: 'S' | 'A' | 'B' | 'C'
}

const isGood = (grade: Grade) => grade === 'best' || grade === 'correct'

export function summarize(answers: readonly SessionAnswer[]): SessionSummary {
  let streak = 0
  let bestStreak = 0
  for (const { grade } of answers) {
    streak = isGood(grade) ? streak + 1 : 0
    bestStreak = Math.max(bestStreak, streak)
  }
  const good = answers.filter((a) => isGood(a.grade)).length
  const rate = answers.length === 0 ? 0 : good / answers.length
  const allBest = answers.length > 0 && answers.every((a) => a.grade === 'best')
  return {
    answered: answers.length,
    good,
    xp: answers.reduce((sum, a) => sum + a.xp, 0),
    bestStreak,
    score: allBest ? 'S' : rate >= 0.8 ? 'A' : rate >= 0.6 ? 'B' : 'C',
  }
}
