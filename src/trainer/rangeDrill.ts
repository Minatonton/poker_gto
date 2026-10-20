import { ALL_HANDS, comboCount, type HandClass } from '../poker/hands'
import type { Strategy } from '../poker/strategy'

/** 塗れる頻度。25% 刻みにしているのは、細かすぎると覚えられず、粗すぎると混合を表せないため */
export const PAINT_AMOUNTS = [1, 0.75, 0.5, 0.25] as const

/**
 * ハンドの頻度のうち、塗ったアクションを amount にする。
 * 他のアクション（fold 以外）は合計が1を超えない範囲で残し、残りを fold にする
 */
export function paint(frequencies: readonly number[], action: number, amount: number, foldIndex: number): number[] {
  const next = [...frequencies]
  next[action] = amount
  const others = next.reduce((sum, f, i) => (i === action || i === foldIndex ? sum : sum + f), 0)
  const room = 1 - amount
  if (others > room) {
    const scale = others === 0 ? 0 : room / others
    next.forEach((f, i) => {
      if (i !== action && i !== foldIndex) next[i] = f * scale
    })
  }
  next[foldIndex] = 0
  next[foldIndex] = Math.max(0, 1 - next.reduce((sum, f) => sum + f, 0))
  return next
}

/** すべて fold の初期状態 */
export function emptyPainting(strategy: Strategy): Map<HandClass, number[]> {
  const foldIndex = strategy.actions.length - 1
  return new Map(ALL_HANDS.map((hand) => [hand, strategy.actions.map((_, i) => (i === foldIndex ? 1 : 0))]))
}

/** ハンドごとに重なっている頻度の割合。完全に一致すれば1、まったく違えば0 */
export function handOverlap(user: readonly number[], gto: readonly number[]): number {
  return gto.reduce((sum, g, i) => sum + Math.min(g, user[i] ?? 0), 0)
}

/**
 * レンジ全体の一致率。この判断に到達するコンボの数で重み付けする。
 * 到達しないハンド（例: 3ベットへの対応で、オープンしていないハンド）は採点に含めない
 */
export function matchScore(user: ReadonlyMap<HandClass, number[]>, gto: Strategy): number {
  let total = 0
  let matched = 0
  for (const hand of ALL_HANDS) {
    const weight = comboCount(hand) * (gto.weights?.get(hand) ?? 1)
    if (weight <= 0) continue
    total += weight
    matched += weight * handOverlap(user.get(hand) ?? [], gto.frequencies.get(hand) ?? [])
  }
  return total === 0 ? 1 : matched / total
}

/** 頻度の差が大きいハンド。答え合わせで印を付ける */
export function mistakes(user: ReadonlyMap<HandClass, number[]>, gto: Strategy, threshold = 0.25): Set<HandClass> {
  const result = new Set<HandClass>()
  for (const hand of ALL_HANDS) {
    if ((gto.weights?.get(hand) ?? 1) <= 0) continue
    if (1 - handOverlap(user.get(hand) ?? [], gto.frequencies.get(hand) ?? []) >= threshold) result.add(hand)
  }
  return result
}
