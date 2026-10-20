import { describe, expect, it } from 'vitest'
import { CHAPTERS } from './chapters'

describe('教材の章', () => {
  it('章の id は重複しない', () => {
    const ids = CHAPTERS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(CHAPTERS.map((c) => [c.title, c] as const))(
    '「%s」は分かることを先に示し、本文と確認問題と出典を持つ',
    (_, chapter) => {
      expect(chapter.points.length).toBeGreaterThan(0)
      expect(chapter.sections.length).toBeGreaterThan(0)
      expect(chapter.quiz.length).toBeGreaterThan(0)
      expect(chapter.sources.length).toBeGreaterThan(0)
    },
  )

  it('確認問題の正解は、選択肢のどれかを指す', () => {
    for (const quiz of CHAPTERS.flatMap((c) => c.quiz)) {
      expect(quiz.answer).toBeGreaterThanOrEqual(0)
      expect(quiz.answer).toBeLessThan(quiz.choices.length)
    }
  })
})
