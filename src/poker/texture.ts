import { cardToId } from './cards'

export type SuitTexture = 'モノトーン' | 'ツートーン' | 'レインボー'

export interface BoardTexture {
  /** 最も高いカードのランク（A, K, ...） */
  highCard: string
  suits: SuitTexture
  paired: boolean
  /** 3枚の最高と最低のランクの差が4以内（ストレートが作れる並び） */
  connected: boolean
}

const RANK_CHARS = '23456789TJQKA'

export function boardTexture(flop: readonly string[]): BoardTexture {
  const ids = flop.map(cardToId)
  const ranks = ids.map((id) => id >> 2).sort((a, b) => b - a)
  const suitCount = new Set(ids.map((id) => id & 3)).size
  const unique = [...new Set(ranks)]
  // A は 5 ハイのストレートの下にもなるので、A を含むときは低い側としても見る
  const spans = [unique[0] - unique[unique.length - 1]]
  if (unique[0] === 12) spans.push(Math.max(...unique.slice(1), -1) + 1)
  return {
    highCard: RANK_CHARS[ranks[0]],
    suits: suitCount === 1 ? 'モノトーン' : suitCount === 2 ? 'ツートーン' : 'レインボー',
    paired: unique.length < ranks.length,
    connected: unique.length === 3 && Math.min(...spans) <= 4,
  }
}

/*
 * 集合分析で解く代表的なフロップ。全 1,755 通りを解くと何十時間もかかるため、
 * ハイカード・スート・ペア・つながりの組み合わせが偏らないように選んでいる
 */
export const REPRESENTATIVE_FLOPS: string[][] = [
  ['As', '7d', '2c'],
  ['As', 'Kd', '5c'],
  ['Ah', 'Qh', '6d'],
  ['As', 'Js', '9s'],
  ['Ah', 'Ad', '6c'],
  ['Kh', '8d', '3c'],
  ['Ks', 'Qd', '7c'],
  ['Kh', 'Th', '4d'],
  ['Ks', '9s', '6s'],
  ['Kd', 'Kc', '7h'],
  ['Qd', '7c', '2h'],
  ['Qs', 'Jd', '9c'],
  ['Jh', '8d', '4c'],
  ['Js', 'Ts', '7d'],
  ['Th', '9d', '3c'],
  ['Ts', '6s', '4d'],
  ['9h', '7d', '2c'],
  ['8s', '7d', '5c'],
  ['8h', '8d', '3c'],
  ['7h', '6d', '2c'],
  ['6s', '5d', '4c'],
  ['5h', '4h', '3d'],
  ['4s', '3d', '2c'],
  ['2s', '2d', '9c'],
]
