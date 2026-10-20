import { describe, expect, it } from 'vitest'
import { handClassOf } from '../poker/cards'
import { dealFromRange, weightedPick } from './sampling'

describe('weightedPick', () => {
  it('重みに比例して選ぶ', () => {
    const items = ['a', 'b']
    expect(
      weightedPick(
        items,
        (i) => (i === 'a' ? 1 : 3),
        () => 0.2,
      ),
    ).toBe('a')
    expect(
      weightedPick(
        items,
        (i) => (i === 'a' ? 1 : 3),
        () => 0.3,
      ),
    ).toBe('b')
  })

  it('重みがすべて0なら何も選ばない', () => {
    expect(weightedPick(['a'], () => 0)).toBeNull()
  })
})

describe('dealFromRange', () => {
  it('レンジに含まれるハンドクラスの2枚を配る', () => {
    const dealt = dealFromRange(
      new Map([
        ['AKs', 1],
        ['72o', 0],
      ]),
    )
    expect(dealt?.hand).toBe('AKs')
    expect(handClassOf(dealt!.cards.join(''))).toBe('AKs')
  })

  it('配れるハンドがなければ null', () => {
    expect(dealFromRange(new Map([['AA', 0]]))).toBeNull()
  })
})
