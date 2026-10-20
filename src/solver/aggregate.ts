import { handClassOf } from '../poker/cards'
import { ALL_HANDS, comboCount, type HandClass } from '../poker/hands'
import type { Action, Strategy } from '../poker/strategy'
import { CHIPS_PER_BB, type PlayerNode, type SolverAction } from './types'

export interface HandStats {
  /** bb */
  ev: number
  equity: number
  /** strategy.actions と同じ並びの、そのアクションを選んだときの EV（bb） */
  actionEvs: number[]
}

export interface AggregatedNode {
  strategy: Strategy
  stats: Map<HandClass, HandStats>
}

export const toBb = (chips: number) => chips / CHIPS_PER_BB

/** ソルバーのコンボ単位の結果を、13x13 グリッド用にハンドクラス単位へ集約する */
export function aggregateNode(node: PlayerNode): AggregatedNode {
  const actions = toActions(node.actions, node.pot)
  const sums = new Map<
    HandClass,
    { weight: number; normalizedWeight: number; strategy: number[]; actionEvs: number[]; ev: number; equity: number }
  >()

  for (const hand of node.hands) {
    if (hand.weight <= 0 || hand.normalizedWeight <= 0) continue
    const handClass = handClassOf(hand.cards)
    const sum = sums.get(handClass) ?? {
      weight: 0,
      normalizedWeight: 0,
      strategy: actions.map(() => 0),
      actionEvs: actions.map(() => 0),
      ev: 0,
      equity: 0,
    }
    const w = hand.normalizedWeight
    sum.weight += hand.weight
    sum.normalizedWeight += w
    hand.strategy.forEach((f, i) => (sum.strategy[i] += f * w))
    hand.actionEvs.forEach((ev, i) => (sum.actionEvs[i] += (ev ?? 0) * w))
    sum.ev += (hand.ev ?? 0) * w
    sum.equity += (hand.equity ?? 0) * w
    sums.set(handClass, sum)
  }

  const frequencies = new Map<HandClass, number[]>()
  const weights = new Map<HandClass, number>()
  const stats = new Map<HandClass, HandStats>()
  for (const hand of ALL_HANDS) {
    const sum = sums.get(hand)
    if (!sum) {
      frequencies.set(hand, actions.map(() => 0))
      weights.set(hand, 0)
      continue
    }
    frequencies.set(hand, sum.strategy.map((f) => f / sum.normalizedWeight))
    weights.set(hand, sum.weight / comboCount(hand))
    stats.set(hand, {
      ev: toBb(sum.ev / sum.normalizedWeight),
      equity: sum.equity / sum.normalizedWeight,
      actionEvs: sum.actionEvs.map((ev) => toBb(ev / sum.normalizedWeight)),
    })
  }

  return { strategy: { actions, frequencies, weights }, stats }
}

const AGGRESSIVE_KINDS = new Set<SolverAction['kind']>(['bet', 'raise', 'allin'])

export function toActions(solverActions: SolverAction[], pot: number): Action[] {
  const aggressive = solverActions.filter((a) => AGGRESSIVE_KINDS.has(a.kind))
  return solverActions.map((action) => {
    if (action.kind === 'fold') return { kind: 'fold', label: 'Fold' }
    if (action.kind === 'check') return { kind: 'call', label: 'Check' }
    if (action.kind === 'call') return { kind: 'call', label: 'Call' }

    const bb = Number(toBb(action.amount).toFixed(2))
    const name = { bet: 'Bet', raise: 'Raise', allin: 'Allin' }[action.kind]
    const potShare = action.kind === 'bet' ? ` (${Math.round((action.amount / pot) * 100)}%)` : ''
    return { kind: 'raise', label: `${name} ${bb}bb${potShare}`, amount: bb, shade: aggressive.indexOf(action) }
  })
}

export interface EquityPoint {
  /** レンジの上位から何割のところか（0〜1） */
  percentile: number
  equity: number
}

/** EQ の高い順に並べ、コンボの重みの累積を横軸にした曲線。グラフが上にあるほどレンジが強い */
export function equityCurve(hands: { normalizedWeight: number; equity: number | null }[]): EquityPoint[] {
  const reaching = hands
    .filter((h) => h.normalizedWeight > 0 && h.equity !== null)
    .sort((a, b) => (b.equity ?? 0) - (a.equity ?? 0))
  const total = reaching.reduce((sum, h) => sum + h.normalizedWeight, 0)
  let cumulative = 0
  return reaching.map((h) => {
    cumulative += h.normalizedWeight
    return { percentile: cumulative / total, equity: h.equity ?? 0 }
  })
}
