import { cardToId, isSameHoleCards } from '../poker/cards'
import type { NodeInfo, PlayerNode } from '../solver/types'
import { weightedPick } from './sampling'

type Side = 0 | 1

const splitCards = (cards: string): [string, string] => [cards.slice(0, 2), cards.slice(2, 4)]
const overlaps = (a: readonly string[], b: readonly string[]) => a.some((card) => b.includes(card))

/**
 * ルートのノードから、両者の手札を各自のレンジの重みに沿って配る。
 * 相手の手札は自分の手札と重ならないものから選ぶ
 */
export function dealPostflopHands(
  root: PlayerNode,
  heroSide: Side,
  random = Math.random,
): { hero: [string, string]; villain: [string, string] } | null {
  const sideHands = (side: Side) => (root.player === side ? root.hands : root.opponentHands)
  const heroCombo = weightedPick(sideHands(heroSide), (h) => h.weight, random)
  if (!heroCombo) return null
  const hero = splitCards(heroCombo.cards)
  const villainCandidates = sideHands(heroSide === 0 ? 1 : 0).filter((h) => !overlaps(splitCards(h.cards), hero))
  const villainCombo = weightedPick(villainCandidates, (h) => h.weight, random)
  if (!villainCombo) return null
  return { hero, villain: splitCards(villainCombo.cards) }
}

/** 手番の相手が、自分の手札での戦略の頻度どおりにアクションを選ぶ */
export function villainAction(node: PlayerNode, villainCards: [string, string], random = Math.random): number {
  const combo = node.hands.find((h) => isSameHoleCards(h.cards, villainCards.join('')))
  if (!combo) throw new Error('相手の手札がレンジに見つかりません')
  const indices = combo.strategy.map((_, i) => i)
  return weightedPick(indices, (i) => combo.strategy[i], random) ?? 0
}

/** 両者の手札と重ならないカードからターン・リバーを配る */
export function dealNextCard(
  node: Extract<NodeInfo, { kind: 'chance' }>,
  dead: readonly string[],
  random = Math.random,
): number {
  const deadIds = new Set(dead.map(cardToId))
  const candidates = node.possibleCards.filter((id) => !deadIds.has(id))
  if (candidates.length === 0) throw new Error('配れるカードがありません')
  return candidates[Math.floor(random() * candidates.length)]
}

