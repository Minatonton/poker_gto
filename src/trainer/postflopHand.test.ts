import { describe, expect, it } from 'vitest'
import { cardToId } from '../poker/cards'
import type { PlayerNode } from '../solver/types'
import { dealNextCard, dealPostflopHands, villainAction } from './postflopHand'

const hand = (cards: string, weight: number, strategy = [1, 0]) => ({
  cards,
  weight,
  normalizedWeight: weight,
  strategy,
  actionEvs: [0, 0],
  ev: 0,
  equity: 0,
})

const root: PlayerNode = {
  kind: 'player',
  player: 0,
  board: ['Td', '9d', '6h'],
  pot: 550,
  bets: [0, 0],
  actions: [
    { kind: 'check', amount: 0 },
    { kind: 'bet', amount: 182 },
  ],
  hands: [hand('AsKs', 1), hand('QcQh', 0)],
  opponentHands: [
    { cards: 'AsAh', weight: 1, normalizedWeight: 1, ev: 0, equity: 0 },
    { cards: 'JcJh', weight: 1, normalizedWeight: 1, ev: 0, equity: 0 },
  ],
  ranges: [
    { combos: 0, equity: 0, ev: 0, eqr: 0 },
    { combos: 0, equity: 0, ev: 0, eqr: 0 },
  ],
}

describe('dealPostflopHands', () => {
  it('自分には重みのあるハンドだけを配り、相手には自分と重ならないハンドを配る', () => {
    for (let i = 0; i < 20; i++) {
      const dealt = dealPostflopHands(root, 0)!
      expect(dealt.hero).toEqual(['As', 'Ks'])
      expect(dealt.villain).toEqual(['Jc', 'Jh'])
    }
  })

  it('IP 側で配るときは、手番でない側のハンドから選ぶ', () => {
    const dealt = dealPostflopHands(root, 1, () => 0.75)!
    expect(dealt.hero).toEqual(['Jc', 'Jh'])
    expect(dealt.villain).toEqual(['As', 'Ks'])
  })

  it('相手に配れるハンドがすべて自分と重なるなら null', () => {
    expect(dealPostflopHands(root, 1, () => 0.1)).toBeNull()
  })
})

describe('villainAction', () => {
  it('相手の手札の戦略の頻度どおりに選ぶ', () => {
    const node = { ...root, hands: [hand('AsKs', 1, [0.25, 0.75])] }
    expect(villainAction(node, ['Ks', 'As'], () => 0.1)).toBe(0)
    expect(villainAction(node, ['Ks', 'As'], () => 0.5)).toBe(1)
  })
})

describe('dealNextCard', () => {
  it('手札と重なるカードは配らない', () => {
    const node = {
      kind: 'chance' as const,
      board: [],
      pot: 0,
      bets: [0, 0] as [number, number],
      possibleCards: [cardToId('As'), cardToId('2c')],
    }
    expect(dealNextCard(node, ['As', 'Kd'])).toBe(cardToId('2c'))
  })
})
