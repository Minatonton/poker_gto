import { rankIndex, type HandClass } from './hands'

/** postflop-solver のカード番号の並び（card_id = 4 * rank + suit、rank は 2 が 0） */
const SOLVER_RANKS = '23456789TJQKA'
export const SUITS = ['c', 'd', 'h', 's'] as const

export type Suit = (typeof SUITS)[number]

export function cardFromId(id: number): string {
  return SOLVER_RANKS[id >> 2] + SUITS[id & 3]
}

export function cardToId(card: string): number {
  const rank = SOLVER_RANKS.indexOf(card[0])
  const suit = SUITS.indexOf(card[1] as Suit)
  if (card.length !== 2 || rank === -1 || suit === -1) throw new Error(`カードを解釈できません: ${card}`)
  return rank * 4 + suit
}

/** "As Kd 7c" や "AsKd7c" を ['As', 'Kd', '7c'] にする */
export function parseBoard(text: string): string[] {
  const cards = parseCardList(text)
  if (cards.length < 3 || cards.length > 5) throw new Error('ボードは3〜5枚で指定してください')
  return cards
}

/** "Ah Kh" や "ahkh" を ['Ah', 'Kh'] にする */
export function parseHoleCards(text: string): [string, string] {
  const cards = parseCardList(text)
  if (cards.length !== 2) throw new Error('手札は2枚で指定してください（例: AhKh）')
  return [cards[0], cards[1]]
}

/** 枚数を問わずにカードを並べたものを解釈する。空なら空配列 */
export function parseCardList(text: string): string[] {
  const compact = text.replace(/[\s,]/g, '')
  if (compact.length % 2 !== 0) throw new Error(`カードを解釈できません: ${text}`)
  const cards = Array.from({ length: compact.length / 2 }, (_, i) => {
    const card = compact.slice(i * 2, i * 2 + 2)
    return card[0].toUpperCase() + card[1].toLowerCase()
  })
  cards.forEach(cardToId)
  if (new Set(cards).size !== cards.length) throw new Error('同じカードが含まれています')
  return cards
}

/** "AhKh" と "KhAh" のように並び順だけが違うホールカードを同じとみなす */
export function isSameHoleCards(a: string, b: string): boolean {
  const sorted = (cards: string) => [cards.slice(0, 2), cards.slice(2, 4)].sort().join('')
  return sorted(a) === sorted(b)
}

/** excluded（自分の手札など）を除いたデッキから3枚を引く */
export function randomFlop(excluded: readonly string[] = [], random: () => number = Math.random): string[] {
  const excludedIds = new Set(excluded.map(cardToId))
  const deck = Array.from({ length: 52 }, (_, id) => id).filter((id) => !excludedIds.has(id))
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck.slice(0, 3).map(cardFromId)
}

/** "AsKd" のような2枚のホールカードを "AKo" のようなハンドクラスにする */
export function handClassOf(holeCards: string): HandClass {
  const [first, second] = [holeCards.slice(0, 2), holeCards.slice(2, 4)].sort(
    (a, b) => rankIndex(a[0]) - rankIndex(b[0]),
  )
  if (first[0] === second[0]) return first[0] + second[0]
  return first[0] + second[0] + (first[1] === second[1] ? 's' : 'o')
}

/** フロップの3枚だけを強い順に並べ、ターンとリバーは配られた順のままにする */
export function displayBoard(cards: string[]): string[] {
  const flop = cards.slice(0, 3).sort((a, b) => rankIndex(a[0]) - rankIndex(b[0]))
  return [...flop, ...cards.slice(3)]
}
