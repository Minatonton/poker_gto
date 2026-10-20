/** 役の種類。大きいほど強い */
export const HAND_CATEGORIES = [
  'ハイカード',
  'ワンペア',
  'ツーペア',
  'スリーカード',
  'ストレート',
  'フラッシュ',
  'フルハウス',
  'フォーカード',
  'ストレートフラッシュ',
] as const

export type HandCategory = (typeof HAND_CATEGORIES)[number]

const rankOf = (id: number) => id >> 2
const suitOf = (id: number) => id & 3

/**
 * 5〜7枚から作れる最も強い5枚の強さ。大きいほど強く、同じ値は引き分け。
 * 役の種類を上位の桁に、比べる順のランクを下位の桁に詰めた整数にしている。
 * 21通りの5枚の組を総当たりしないのは、エクイティの計算で何万回も呼ぶため
 */
export function evaluate(cards: readonly number[]): number {
  const rankCounts = new Array<number>(13).fill(0)
  const suitCards: number[][] = [[], [], [], []]
  for (const card of cards) {
    rankCounts[rankOf(card)]++
    suitCards[suitOf(card)].push(rankOf(card))
  }

  const flushRanks = suitCards.find((ranks) => ranks.length >= 5)
  if (flushRanks) {
    const straightFlushHigh = straightHigh(new Set(flushRanks))
    if (straightFlushHigh >= 0) return score(8, [straightFlushHigh])
  }

  const byCount = (n: number) => descendingRanks(rankCounts, (c) => c >= n)
  const quads = byCount(4)
  if (quads.length > 0) return score(7, [quads[0], ...kickers(rankCounts, [quads[0]], 1)])

  const trips = byCount(3)
  const pairs = byCount(2)
  if (trips.length > 0) {
    const pairForFull = pairs.find((r) => r !== trips[0])
    if (pairForFull !== undefined) return score(6, [trips[0], pairForFull])
  }

  if (flushRanks) return score(5, [...flushRanks].sort((a, b) => b - a).slice(0, 5))

  const straight = straightHigh(new Set(cards.map(rankOf)))
  if (straight >= 0) return score(4, [straight])

  if (trips.length > 0) return score(3, [trips[0], ...kickers(rankCounts, [trips[0]], 2)])
  if (pairs.length >= 2) return score(2, [pairs[0], pairs[1], ...kickers(rankCounts, pairs.slice(0, 2), 1)])
  if (pairs.length === 1) return score(1, [pairs[0], ...kickers(rankCounts, [pairs[0]], 3)])
  return score(0, kickers(rankCounts, [], 5))
}

export function categoryOf(value: number): HandCategory {
  return HAND_CATEGORIES[Math.floor(value / 16 ** 5)]
}

function score(category: number, ranks: number[]): number {
  let value = category
  for (let i = 0; i < 5; i++) value = value * 16 + (ranks[i] ?? 0)
  return value
}

function descendingRanks(counts: number[], predicate: (count: number) => boolean): number[] {
  const ranks: number[] = []
  for (let r = 12; r >= 0; r--) if (predicate(counts[r])) ranks.push(r)
  return ranks
}

function kickers(counts: number[], used: number[], n: number): number[] {
  return descendingRanks(counts, (c) => c > 0)
    .filter((r) => !used.includes(r))
    .slice(0, n)
}

/** ストレートの一番上のランク。なければ -1。A は 5 ハイのストレート（ホイール）の下にもなる */
function straightHigh(ranks: Set<number>): number {
  for (let high = 12; high >= 4; high--) {
    let run = true
    for (let r = high; r > high - 5; r--) {
      if (!ranks.has(r)) {
        run = false
        break
      }
    }
    if (run) return high
  }
  const wheel = [12, 0, 1, 2, 3].every((r) => ranks.has(r))
  return wheel ? 3 : -1
}
