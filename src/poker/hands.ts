export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const

export type Rank = (typeof RANKS)[number]

/** 'AA' | 'AKs' | 'AKo' のような169種類のスターティングハンド */
export type HandClass = string

export const TOTAL_COMBOS = 1326

export function rankIndex(rank: string): number {
  const index = RANKS.indexOf(rank as Rank)
  if (index === -1) throw new Error(`不正なランクです: ${rank}`)
  return index
}

/** 13x13グリッドのセル。対角がペア、右上がスーテッド、左下がオフスートになる。 */
export function handAt(row: number, col: number): HandClass {
  if (row === col) return RANKS[row] + RANKS[col]
  if (row < col) return RANKS[row] + RANKS[col] + 's'
  return RANKS[col] + RANKS[row] + 'o'
}

export const HAND_GRID: HandClass[][] = RANKS.map((_, row) =>
  RANKS.map((_, col) => handAt(row, col)),
)

export const ALL_HANDS: HandClass[] = HAND_GRID.flat()

export function comboCount(hand: HandClass): number {
  if (hand.length === 2) return 6
  return hand.endsWith('s') ? 4 : 12
}
