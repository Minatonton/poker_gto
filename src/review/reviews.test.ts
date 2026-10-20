import { describe, expect, it } from 'vitest'
import { mergeReviews, newReview } from './reviews'

describe('newReview', () => {
  it('指定しなかった項目は空で作る', () => {
    const review = newReview({ heroCards: 'AhKh' })
    expect(review.heroCards).toBe('AhKh')
    expect(review.thought).toBe('')
    expect(review.id).not.toBe('')
  })
})

describe('mergeReviews', () => {
  const old = newReview({ id: 'a', createdAt: '2026-10-01T00:00:00Z', lesson: '古い' })

  it('同じ id の記録は読み込んだ方で上書きする', () => {
    const merged = mergeReviews([old], [{ id: 'a', createdAt: old.createdAt, lesson: '新しい' }])
    expect(merged).toHaveLength(1)
    expect(merged[0].lesson).toBe('新しい')
  })

  it('新しい記録が先に並ぶ', () => {
    const merged = mergeReviews([old], [{ id: 'b', createdAt: '2026-10-20T00:00:00Z' }])
    expect(merged.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('記録の形でなければエラーになる', () => {
    expect(() => mergeReviews([], { id: 'a' })).toThrow()
    expect(() => mergeReviews([], [{ lesson: 'id がない' }])).toThrow()
  })
})
