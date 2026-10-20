import { categoryOf, evaluate } from './evaluator'

export const MADE_CATEGORIES = [
  'フラッシュ以上',
  'ストレート',
  'セット・トリップス',
  'ツーペア',
  'オーバーペア',
  'トップペア',
  'セカンドペア',
  '弱いペア',
  'Aハイ',
  'ハイカード',
] as const

export type MadeCategory = (typeof MADE_CATEGORIES)[number]

export const DRAWS = ['ナッツフラッシュドロー', 'フラッシュドロー', 'オープンエンド', 'ガットショット', 'バックドアフラッシュ'] as const

export type Draw = (typeof DRAWS)[number]

/** Amu 氏の note「Robust Equity」の分類。相手に打たれても EQ を保ちやすいか */
export type Robustness = 'robust' | 'middle' | 'vulnerable'

export interface HandClassification {
  made: MadeCategory
  draws: Draw[]
  robustness: Robustness
}

const rankOf = (id: number) => id >> 2
const suitOf = (id: number) => id & 3
const ACE = 12

/** ボードとホールカードから、役の分類・ドロー・EQ の崩れにくさを求める */
export function classifyHand(hole: [number, number], board: readonly number[]): HandClassification {
  const made = madeCategory(hole, board)
  const draws = board.length < 5 ? drawsOf(hole, board) : []
  return { made, draws, robustness: robustnessOf(made, draws) }
}

function madeCategory(hole: [number, number], board: readonly number[]): MadeCategory {
  const handValue = evaluate([...hole, ...board])
  const category = categoryOf(handValue)
  // ボードだけで同じ強さの役ができているなら、手札は役に関わっていない
  const boardOnly = board.length >= 5 ? evaluate(board) : -1
  const playsTheBoard = boardOnly === handValue

  if (!playsTheBoard) {
    if (['フラッシュ', 'フルハウス', 'フォーカード', 'ストレートフラッシュ'].includes(category)) return 'フラッシュ以上'
    if (category === 'ストレート') return 'ストレート'
    if (category === 'スリーカード' && hole.some((c) => board.some((b) => rankOf(b) === rankOf(c)))) {
      return 'セット・トリップス'
    }
    if (category === 'ツーペア' && !boardHasPair(board)) return 'ツーペア'
  }

  const boardRanks = [...new Set(board.map(rankOf))].sort((a, b) => b - a)
  const [h1, h2] = hole.map(rankOf)
  if (h1 === h2) {
    if (h1 > boardRanks[0]) return 'オーバーペア'
    if (boardRanks.includes(h1)) return 'セット・トリップス'
    return h1 > (boardRanks[1] ?? -1) ? 'セカンドペア' : '弱いペア'
  }
  const paired = [h1, h2].filter((r) => boardRanks.includes(r))
  if (paired.length > 0) {
    const best = Math.max(...paired)
    if (best === boardRanks[0]) return 'トップペア'
    if (best === boardRanks[1]) return 'セカンドペア'
    return '弱いペア'
  }
  return h1 === ACE || h2 === ACE ? 'Aハイ' : 'ハイカード'
}

function boardHasPair(board: readonly number[]): boolean {
  return new Set(board.map(rankOf)).size < board.length
}

function drawsOf(hole: [number, number], board: readonly number[]): Draw[] {
  const draws: Draw[] = []
  const cards = [...hole, ...board]
  for (let suit = 0; suit < 4; suit++) {
    const suited = cards.filter((c) => suitOf(c) === suit)
    const holeSuited = hole.filter((c) => suitOf(c) === suit)
    if (holeSuited.length === 0) continue
    if (suited.length === 4) {
      const highestMissing = [...Array(13).keys()].reverse().find((r) => !suited.some((c) => rankOf(c) === r))
      draws.push(holeSuited.some((c) => rankOf(c) === highestMissing || rankOf(c) === ACE) ? 'ナッツフラッシュドロー' : 'フラッシュドロー')
    } else if (suited.length === 3 && holeSuited.length === 2 && board.length === 3) {
      draws.push('バックドアフラッシュ')
    }
  }

  const ranks = new Set(cards.map(rankOf))
  const boardRanks = new Set(board.map(rankOf))
  const outs = [...Array(13).keys()].filter(
    (r) => !ranks.has(r) && makesStraight(new Set([...ranks, r])) && !makesStraight(new Set([...boardRanks, r])),
  )
  if (!makesStraight(ranks)) {
    if (outs.length >= 2) draws.push('オープンエンド')
    else if (outs.length === 1) draws.push('ガットショット')
  }
  return draws
}

function makesStraight(ranks: Set<number>): boolean {
  const has = (r: number) => ranks.has(r) || (r === -1 && ranks.has(ACE))
  for (let high = 12; high >= 3; high--) {
    let run = true
    for (let r = high; r > high - 5; r--) if (!has(r)) run = false
    if (run) return true
  }
  return false
}

function robustnessOf(made: MadeCategory, draws: Draw[]): Robustness {
  if (['フラッシュ以上', 'ストレート', 'セット・トリップス', 'ツーペア'].includes(made)) return 'robust'
  if (draws.includes('ナッツフラッシュドロー') || draws.includes('オープンエンド')) return 'robust'
  if (['オーバーペア', 'トップペア'].includes(made)) return 'middle'
  if (draws.includes('フラッシュドロー') || draws.includes('ガットショット')) return 'middle'
  return 'vulnerable'
}
