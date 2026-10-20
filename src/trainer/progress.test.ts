import { describe, expect, it } from 'vitest'
import { accuracy, emptyProgress, normalizeProgress, rankOf, recordAnswer, todayCount, xpFor } from './progress'

const day1 = new Date(2026, 9, 20, 10)
const day2 = new Date(2026, 9, 21, 10)

describe('recordAnswer', () => {
  it('Best か Correct が続くと連続正解が伸び、それ以外で0に戻る', () => {
    let progress = recordAnswer(emptyProgress(), 'best', day1)
    progress = recordAnswer(progress, 'correct', day1)
    expect(progress.streak).toBe(2)
    progress = recordAnswer(progress, 'wrong', day1)
    expect(progress.streak).toBe(0)
    expect(progress.bestStreak).toBe(2)
  })

  it('日付が変わると今日の問題数は1から数え直す', () => {
    let progress = recordAnswer(emptyProgress(), 'best', day1)
    progress = recordAnswer(progress, 'best', day1)
    expect(todayCount(progress, day1)).toBe(2)
    progress = recordAnswer(progress, 'best', day2)
    expect(todayCount(progress, day2)).toBe(1)
  })

  it('前の日の分は、今日の問題数に数えない', () => {
    const progress = recordAnswer(emptyProgress(), 'best', day1)
    expect(todayCount(progress, day2)).toBe(0)
  })
})

describe('accuracy', () => {
  it('Best と Correct の割合を返し、答えていなければ null', () => {
    expect(accuracy(emptyProgress())).toBeNull()
    const progress = recordAnswer(recordAnswer(emptyProgress(), 'best', day1), 'wrong', day1)
    expect(accuracy(progress)).toBe(0.5)
  })
})

describe('normalizeProgress', () => {
  it('採点の内訳だけを保存していた以前の形も読める', () => {
    const progress = normalizeProgress({ best: 3, correct: 1, inaccuracy: 0, wrong: 2, blunder: 0 })
    expect(progress.grades.best).toBe(3)
    expect(progress.streak).toBe(0)
  })
})

describe('経験値とランク', () => {
  it('外しても経験値は減らず、Best は連続正解の分だけ上乗せされる', () => {
    expect(xpFor('wrong', 0)).toBeGreaterThan(0)
    expect(xpFor('best', 5)).toBeGreaterThan(xpFor('best', 1))
    expect(xpFor('blunder', 0)).toBe(0)
  })

  it('連続正解の上乗せには上限がある', () => {
    expect(xpFor('best', 50)).toBe(xpFor('best', 10))
  })

  it('答えるたびに経験値が貯まる', () => {
    const progress = recordAnswer(recordAnswer(emptyProgress(), 'best', day1), 'best', day1)
    expect(progress.xp).toBe(xpFor('best', 1) + xpFor('best', 2))
  })

  it('ランクは経験値で決まり、次のランクまでの残りが分かる', () => {
    expect(rankOf(0)).toMatchObject({ name: 'ブロンズ', progress: 0, next: { name: 'シルバー', remaining: 200 } })
    expect(rankOf(400).name).toBe('シルバー')
    expect(rankOf(400).progress).toBeCloseTo(0.5)
    expect(rankOf(99999)).toMatchObject({ name: 'マスター', progress: 1, next: null })
  })

  it('経験値を持たない以前の記録は 0 から始める', () => {
    expect(normalizeProgress({ grades: emptyProgress().grades, streak: 0, bestStreak: 0 }).xp).toBe(0)
  })
})
