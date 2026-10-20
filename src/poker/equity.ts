import { cardToId } from './cards'
import { evaluate } from './evaluator'
import type { HandClass } from './hands'

/** ハンドクラスを、デッキから取り除かれていないカードで作れる具体的な2枚の組に展開する */
export function combosOf(hand: HandClass, dead: ReadonlySet<number>): [number, number][] {
  const ranks = hand.slice(0, 2).split('').map((r) => cardToId(`${r}c`) >> 2)
  const suited = hand.endsWith('s')
  const combos: [number, number][] = []
  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = 0; s2 < 4; s2++) {
      const pair = ranks[0] === ranks[1]
      if (pair ? s2 <= s1 : suited ? s1 !== s2 : s1 === s2) continue
      const a = ranks[0] * 4 + s1
      const b = ranks[1] * 4 + s2
      if (!dead.has(a) && !dead.has(b)) combos.push([a, b])
    }
  }
  return combos
}

export interface EquityResult {
  /** 勝ち + 引き分けの半分 */
  equity: number
  win: number
  tie: number
  samples: number
}

/**
 * 自分の2枚が、相手のレンジとこれから配られるボードに対して持つ EQ。
 * ボードの残りと相手のハンドを抽選するモンテカルロで求める。
 * リバーまで全部の組み合わせを数えないのは、フロップからだと 1,000 万通りを超えて画面が止まるため
 */
export function equityVsRange(
  hero: [number, number],
  board: number[],
  villainRange: Map<HandClass, number>,
  samples = 20000,
  random: () => number = Math.random,
): EquityResult {
  const dead = new Set([...hero, ...board])
  const villainCombos: { cards: [number, number]; weight: number }[] = []
  for (const [hand, weight] of villainRange) {
    if (weight <= 0) continue
    for (const cards of combosOf(hand, dead)) villainCombos.push({ cards, weight })
  }
  if (villainCombos.length === 0) throw new Error('相手のレンジに、手札やボードと重ならないハンドがありません')
  const totalWeight = villainCombos.reduce((sum, c) => sum + c.weight, 0)

  const pickVillain = () => {
    let target = random() * totalWeight
    for (const combo of villainCombos) {
      target -= combo.weight
      if (target <= 0) return combo.cards
    }
    return villainCombos[villainCombos.length - 1].cards
  }

  let win = 0
  let tie = 0
  const deck = Array.from({ length: 52 }, (_, id) => id)
  for (let i = 0; i < samples; i++) {
    const villain = pickVillain()
    const used = new Set([...dead, ...villain])
    const runout = [...board]
    while (runout.length < 5) {
      const card = deck[Math.floor(random() * 52)]
      if (!used.has(card)) {
        used.add(card)
        runout.push(card)
      }
    }
    const heroValue = evaluate([...hero, ...runout])
    const villainValue = evaluate([...villain, ...runout])
    if (heroValue > villainValue) win++
    else if (heroValue === villainValue) tie++
  }
  return { equity: (win + tie / 2) / samples, win: win / samples, tie: tie / samples, samples }
}
