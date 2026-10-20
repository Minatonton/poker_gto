import { ALL_HANDS, TOTAL_COMBOS, comboCount, type HandClass } from './hands'
import { parseRange } from './range'

export type ActionKind = 'raise' | 'call' | 'fold'

export interface Action {
  kind: ActionKind
  label: string
  /** ベット・レイズ後の合計額（bb） */
  amount?: number
  /** 同じ種類のアクションが複数あるときの濃さ。0が最も薄い */
  shade?: number
}

export interface Strategy {
  /** 表示する順に並ぶ */
  actions: Action[]
  /** ハンドごとの、actions と同じ並びの頻度。合計は1になる。 */
  frequencies: Map<HandClass, number[]>
  /** このノードに到達するコンボの割合（0〜1）。省略時はすべて1として扱う */
  weights?: Map<HandClass, number>
}

export interface ActionRange {
  action: Action
  range: string
}

const FREQUENCY_EPSILON = 1e-9

/** fold 以外のアクションのレンジを受け取り、残りの頻度を最後の fold として埋める。 */
export function buildStrategy(actionRanges: ActionRange[]): Strategy {
  const parsed = actionRanges.map(({ range }) => parseRange(range))
  const actions = [...actionRanges.map(({ action }) => action), { kind: 'fold', label: 'Fold' } as Action]

  const frequencies = new Map<HandClass, number[]>()
  for (const hand of ALL_HANDS) {
    const nonFold = parsed.map((range) => range.get(hand) ?? 0)
    const total = nonFold.reduce((sum, f) => sum + f, 0)
    if (total > 1 + FREQUENCY_EPSILON) {
      throw new Error(`${hand} の頻度の合計が1を超えています (${total})`)
    }
    frequencies.set(hand, [...nonFold, Math.max(0, 1 - total)])
  }
  return { actions, frequencies }
}

/** このノードに到達するコンボのうち、各アクションを選ぶ割合 */
export function overallFrequencies(strategy: Strategy): number[] {
  const totals = strategy.actions.map(() => 0)
  let reachingCombos = 0
  for (const [hand, freqs] of strategy.frequencies) {
    const combos = comboCount(hand) * (strategy.weights?.get(hand) ?? 1)
    reachingCombos += combos
    freqs.forEach((f, i) => (totals[i] += f * combos))
  }
  return totals.map((t) => (reachingCombos === 0 ? 0 : t / reachingCombos))
}

/** このノードに到達するコンボ数 */
export function reachingCombos(strategy: Strategy): number {
  if (!strategy.weights) return TOTAL_COMBOS
  let total = 0
  for (const [hand, weight] of strategy.weights) total += comboCount(hand) * weight
  return total
}
