import { describe, expect, it } from 'vitest'
import { aggregateNode, toActions } from './aggregate'
import type { PlayerNode } from './types'

const node = (hands: PlayerNode['hands']): PlayerNode => ({
  kind: 'player',
  player: 0,
  board: ['Td', '9d', '6h'],
  pot: 550,
  bets: [0, 0],
  actions: [
    { kind: 'check', amount: 0 },
    { kind: 'bet', amount: 182 },
  ],
  hands,
})

describe('aggregateNode', () => {
  it('同じハンドクラスのコンボは正規化した重みで重み付けして平均する', () => {
    const { strategy, stats } = aggregateNode(
      node([
        { cards: 'AsKs', weight: 1, normalizedWeight: 200, strategy: [1, 0], ev: 100, equity: 0.6 },
        { cards: 'AhKh', weight: 1, normalizedWeight: 100, strategy: [0, 1], ev: 400, equity: 0.3 },
      ]),
    )
    expect(strategy.frequencies.get('AKs')?.[0]).toBeCloseTo(2 / 3)
    expect(stats.get('AKs')?.ev).toBeCloseTo(2)
    expect(stats.get('AKs')?.equity).toBeCloseTo(0.5)
  })

  it('ハンドクラスの重みは到達確率の合計をコンボ数で割ったものになる', () => {
    const { strategy } = aggregateNode(
      node([{ cards: 'AsKd', weight: 1, normalizedWeight: 300, strategy: [1, 0], ev: 0, equity: 0 }]),
    )
    expect(strategy.weights?.get('AKo')).toBeCloseTo(1 / 12)
  })

  it('到達しないハンドは重み0で統計を持たない', () => {
    const { strategy, stats } = aggregateNode(
      node([{ cards: 'AsKd', weight: 0, normalizedWeight: 0, strategy: [1, 0], ev: 0, equity: 0 }]),
    )
    expect(strategy.weights?.get('AKo')).toBe(0)
    expect(stats.has('AKo')).toBe(false)
  })
})

describe('toActions', () => {
  it('ベットにはbb額とポットに対する割合を表示する', () => {
    const [check, bet] = toActions(
      [
        { kind: 'check', amount: 0 },
        { kind: 'bet', amount: 182 },
      ],
      550,
    )
    expect(check.label).toBe('Check')
    expect(bet.label).toBe('Bet 1.82bb (33%)')
  })

  it('攻撃的なアクションは小さい順に濃くなる', () => {
    const actions = toActions(
      [
        { kind: 'fold', amount: 0 },
        { kind: 'call', amount: 0 },
        { kind: 'raise', amount: 1500 },
        { kind: 'allin', amount: 9750 },
      ],
      1000,
    )
    expect(actions.map((a) => a.shade)).toEqual([undefined, undefined, 0, 1])
  })
})
