import { describe, expect, it } from 'vitest'
import type { Grade } from './grading'
import { summarize } from './session'

const answersOf = (grades: Grade[]) => grades.map((grade) => ({ grade, xp: 10 }))

describe('summarize', () => {
  it('正解の数・経験値の合計・チャレンジ中の最長の連続正解をまとめる', () => {
    const summary = summarize(answersOf(['best', 'correct', 'wrong', 'best', 'best', 'best']))
    expect(summary).toMatchObject({ answered: 6, good: 5, xp: 60, bestStreak: 3 })
  })

  it('全問 Best なら S、8割以上の正解で A、6割以上で B、それ未満は C', () => {
    expect(summarize(answersOf(Array(10).fill('best'))).score).toBe('S')
    expect(summarize(answersOf([...Array(8).fill('correct'), 'wrong', 'wrong'])).score).toBe('A')
    expect(summarize(answersOf([...Array(6).fill('best'), ...Array(4).fill('wrong')])).score).toBe('B')
    expect(summarize(answersOf([...Array(5).fill('best'), ...Array(5).fill('wrong')])).score).toBe('C')
  })
})
