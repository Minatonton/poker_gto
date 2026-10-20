import { handClassOf, parseHoleCards } from './cards'
import type { HandClass } from './hands'
import type { Position } from './preflop'

/** 自分の席と手札の入力 */
export interface HeroInput {
  position: Position | null
  cardsText: string
}

export interface Hero {
  position: Position | null
  cards: [string, string] | null
  handClass: HandClass | null
  error: string
}

export function parseHero(input: HeroInput): Hero {
  if (input.cardsText.trim() === '') return { position: input.position, cards: null, handClass: null, error: '' }
  try {
    const cards = parseHoleCards(input.cardsText)
    return { position: input.position, cards, handClass: handClassOf(cards.join('')), error: '' }
  } catch (error) {
    return { position: input.position, cards: null, handClass: null, error: (error as Error).message }
  }
}

/** その手番が自分のときだけ、自分のハンドを強調する */
export function heroHandFor(hero: Hero, actor: Position): HandClass | null {
  return hero.position === actor ? hero.handClass : null
}
