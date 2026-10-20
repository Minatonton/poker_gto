import { cardToId } from '../poker/cards'
import { classifyHand, DRAWS, MADE_CATEGORIES, type Robustness } from '../poker/handCategory'
import type { OpponentHand, PlayerNode } from './types'

export interface BreakdownRow {
  label: string
  /** このノードに到達するコンボ数 */
  combos: number
  /** レンジのうちこの分類が占める割合 */
  share: number
  equity: number
  /** node.actions と同じ並びの頻度 */
  frequencies: number[]
}

export interface RangeShape {
  /** EQ 75% 以上のコンボの割合 */
  strong: number
  medium: number
  /** EQ 25% 以下のコンボの割合 */
  weak: number
  label: 'ポラライズ' | 'コンデンス' | 'リニア'
}

const toIds = (cards: string): [number, number] => [cardToId(cards.slice(0, 2)), cardToId(cards.slice(2, 4))]

/** 手番のレンジを役・ドロー・EQ の崩れにくさで分け、それぞれの割合・EQ・戦略を集計する */
export function breakdownNode(node: PlayerNode): {
  made: BreakdownRow[]
  draws: BreakdownRow[]
  robustness: Record<Robustness, BreakdownRow>
} {
  const board = node.board.map(cardToId)
  const sums = new Map<string, { weight: number; combos: number; equity: number; strategy: number[] }>()
  let totalWeight = 0
  const add = (key: string, w: number, combos: number, equity: number, strategy: number[]) => {
    const sum = sums.get(key) ?? { weight: 0, combos: 0, equity: 0, strategy: node.actions.map(() => 0) }
    sum.weight += w
    sum.combos += combos
    sum.equity += equity * w
    strategy.forEach((f, i) => (sum.strategy[i] += f * w))
    sums.set(key, sum)
  }

  for (const hand of node.hands) {
    if (hand.weight <= 0 || hand.normalizedWeight <= 0) continue
    const w = hand.normalizedWeight
    totalWeight += w
    const { made, draws, robustness } = classifyHand(toIds(hand.cards), board)
    const equity = hand.equity ?? 0
    add(`made:${made}`, w, hand.weight, equity, hand.strategy)
    for (const draw of draws) add(`draw:${draw}`, w, hand.weight, equity, hand.strategy)
    add(`robust:${robustness}`, w, hand.weight, equity, hand.strategy)
  }

  const row = (key: string, label: string): BreakdownRow => {
    const sum = sums.get(key)
    if (!sum) return { label, combos: 0, share: 0, equity: 0, frequencies: node.actions.map(() => 0) }
    return {
      label,
      combos: sum.combos,
      share: sum.weight / totalWeight,
      equity: sum.equity / sum.weight,
      frequencies: sum.strategy.map((f) => f / sum.weight),
    }
  }

  return {
    made: MADE_CATEGORIES.map((c) => row(`made:${c}`, c)).filter((r) => r.combos > 0),
    draws: DRAWS.map((d) => row(`draw:${d}`, d)).filter((r) => r.combos > 0),
    robustness: {
      robust: row('robust:robust', 'Robust'),
      middle: row('robust:middle', '中間'),
      vulnerable: row('robust:vulnerable', 'Vulnerable'),
    },
  }
}

const STRONG = 0.75
const WEAK = 0.25

/**
 * EQ の分布からレンジの形を判定する。強いハンドと弱いハンドに分かれていればポラライズ、
 * 中くらいに集まっていればコンデンス、それ以外は強い順に並ぶリニアとみなす
 */
export function rangeShape(hands: readonly Pick<OpponentHand, 'normalizedWeight' | 'equity'>[]): RangeShape {
  let total = 0
  let strong = 0
  let weak = 0
  for (const hand of hands) {
    if (hand.normalizedWeight <= 0 || hand.equity === null) continue
    total += hand.normalizedWeight
    if (hand.equity >= STRONG) strong += hand.normalizedWeight
    else if (hand.equity <= WEAK) weak += hand.normalizedWeight
  }
  if (total === 0) return { strong: 0, medium: 0, weak: 0, label: 'リニア' }
  const shares = { strong: strong / total, weak: weak / total, medium: (total - strong - weak) / total }
  const label = shares.medium >= 0.55 ? 'コンデンス' : shares.strong + shares.weak >= 0.65 && shares.strong >= 0.2 ? 'ポラライズ' : 'リニア'
  return { ...shares, label }
}
