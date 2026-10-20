import { cardFromId } from '../poker/cards'
import { combosOf } from '../poker/equity'
import { comboCount, type HandClass } from '../poker/hands'

export function weightedPick<T>(items: readonly T[], weightOf: (item: T) => number, random = Math.random): T | null {
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0)
  if (total <= 0) return null
  let target = random() * total
  for (const item of items) {
    target -= Math.max(0, weightOf(item))
    if (target < 0) return item
  }
  return items[items.length - 1]
}

/**
 * レンジの重みに沿って、具体的な2枚を配る。
 * ハンドクラスの重みにコンボ数を掛けて選ぶのは、AKo が AKs の3倍配られる実際の確率に合わせるため
 */
export function dealFromRange(
  range: ReadonlyMap<HandClass, number>,
  dead: ReadonlySet<number> = new Set(),
  random = Math.random,
): { hand: HandClass; cards: [string, string] } | null {
  const hands = [...range.keys()]
  const hand = weightedPick(hands, (h) => (range.get(h) ?? 0) * comboCount(h), random)
  if (!hand) return null
  const combos = combosOf(hand, dead)
  if (combos.length === 0) return null
  const [a, b] = combos[Math.floor(random() * combos.length)]
  return { hand, cards: [cardFromId(a), cardFromId(b)] }
}
