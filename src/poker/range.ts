import { RANKS, rankIndex, type HandClass } from './hands'

export type Range = Map<HandClass, number>

const TOKEN_PATTERN =
  /^([AKQJT2-9])([AKQJT2-9])([so])?(\+)?(?:-([AKQJT2-9])([AKQJT2-9])([so])?)?$/

/**
 * "22+, A2s+, KTs-K7s, AJo:0.5" のような一般的なレンジ表記を、ハンドごとの頻度に変換する。
 * 同じハンドが複数回現れたときは後の指定で上書きする。
 * "64s+, 65s:0.75" のように、広く指定してから一部だけ頻度を下げる書き方をしたいため、合算にはしていない。
 */
export function parseRange(notation: string): Range {
  const range: Range = new Map()
  for (const rawToken of notation.split(',')) {
    const token = rawToken.trim()
    if (token === '') continue
    const [handPart, weightPart] = token.split(':')
    const weight = weightPart === undefined ? 1 : Number(weightPart)
    if (!(weight >= 0 && weight <= 1)) throw new Error(`頻度は0〜1で指定してください: ${token}`)
    for (const hand of expandToken(handPart)) range.set(hand, weight)
  }
  return range
}

function expandToken(token: string): HandClass[] {
  const match = TOKEN_PATTERN.exec(token)
  if (!match) throw new Error(`レンジ表記を解釈できません: ${token}`)
  const [, first, second, suit, plus, dashFirst, dashSecond, dashSuit] = match
  const isDash = dashFirst !== undefined

  if (first === second) {
    if (suit) throw new Error(`ペアにスートは指定できません: ${token}`)
    const from = rankIndex(first)
    if (plus) return pairsBetween(from, 0)
    if (isDash) {
      if (dashFirst !== dashSecond) throw new Error(`ペアの範囲指定が不正です: ${token}`)
      return pairsBetween(from, rankIndex(dashFirst))
    }
    return [first + second]
  }

  const high = rankIndex(first)
  const kicker = rankIndex(second)
  if (high > kicker) throw new Error(`高いランクを先に書いてください: ${token}`)
  const suits = suit ? [suit] : ['s', 'o']

  let kickers: number[]
  if (plus) {
    kickers = indicesBetween(kicker, high + 1)
  } else if (isDash) {
    if (dashFirst !== first || dashSuit !== suit) {
      throw new Error(`範囲指定は同じハイカード・同じスートにしてください: ${token}`)
    }
    kickers = indicesBetween(kicker, rankIndex(dashSecond))
  } else {
    kickers = [kicker]
  }

  return kickers.flatMap((k) => suits.map((s) => RANKS[high] + RANKS[k] + s))
}

function pairsBetween(a: number, b: number): HandClass[] {
  return indicesBetween(a, b).map((i) => RANKS[i] + RANKS[i])
}

function indicesBetween(a: number, b: number): number[] {
  const [lo, hi] = a < b ? [a, b] : [b, a]
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}
