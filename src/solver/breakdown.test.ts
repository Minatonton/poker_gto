import { describe, expect, it } from 'vitest'
import { breakdownNode, rangeShape } from './breakdown'
import type { PlayerNode } from './types'

const hand = (cards: string, equity: number, strategy: number[]) => ({
  cards,
  weight: 1,
  normalizedWeight: 1,
  strategy,
  actionEvs: [0, 0],
  ev: 0,
  equity,
})

const node: PlayerNode = {
  kind: 'player',
  player: 0,
  board: ['Kd', '7c', '2s'],
  pot: 550,
  bets: [0, 0],
  actions: [
    { kind: 'check', amount: 0 },
    { kind: 'bet', amount: 182 },
  ],
  hands: [hand('AhKh', 0.8, [0, 1]), hand('KsQs', 0.7, [0.5, 0.5]), hand('3h3d', 0.2, [1, 0])],
  opponentHands: [],
  ranges: [
    { combos: 0, equity: 0, ev: 0, eqr: 0 },
    { combos: 0, equity: 0, ev: 0, eqr: 0 },
  ],
}

describe('breakdownNode', () => {
  it('役ごとに割合・EQ・戦略の頻度を集計する', () => {
    const { made } = breakdownNode(node)
    const topPair = made.find((r) => r.label === 'トップペア')!
    expect(topPair.combos).toBe(2)
    expect(topPair.share).toBeCloseTo(2 / 3)
    expect(topPair.equity).toBeCloseTo(0.75)
    expect(topPair.frequencies).toEqual([0.25, 0.75])
  })

  it('EQ の崩れにくさでも分ける', () => {
    const { robustness } = breakdownNode(node)
    expect(robustness.middle.combos).toBe(2)
    expect(robustness.vulnerable.combos).toBe(1)
  })
})

describe('rangeShape', () => {
  it('強いハンドと弱いハンドに分かれていればポラライズ', () => {
    const hands = [0.9, 0.85, 0.1, 0.05, 0.5].map((equity) => ({ normalizedWeight: 1, equity }))
    expect(rangeShape(hands).label).toBe('ポラライズ')
  })

  it('中くらいのハンドに集まっていればコンデンス', () => {
    const hands = [0.5, 0.45, 0.55, 0.6, 0.9].map((equity) => ({ normalizedWeight: 1, equity }))
    expect(rangeShape(hands).label).toBe('コンデンス')
  })
})
