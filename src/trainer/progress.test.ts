import { describe, expect, it } from 'vitest'
import { accuracy, emptyProgress, normalizeProgress, recordAnswer, todayCount } from './progress'

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
