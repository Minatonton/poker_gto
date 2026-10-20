import { walkPreflop, type PreflopSolution } from '../poker/preflop'
import type { ActionKind } from '../poker/strategy'
import type { PreflopQuestion } from './preflopDrill'

/** 間違えたプリフロップの問題。同じ卓の人数のときだけ出し直せるので、人数も持つ */
export interface Mistake {
  players: number
  choices: ActionKind[]
  hand: string
  cards: [string, string]
}

/** 古いものから捨てる。復習で出す数がふくらみすぎると、普段の出題より重くなるため */
export const MAX_MISTAKES = 30

const keyOf = (m: Pick<Mistake, 'players' | 'choices' | 'hand'>) => `${m.players}|${m.choices.join(',')}|${m.hand}`

/** 同じ場面・同じハンドは1つにまとめ、最後に間違えたものを先頭に置く */
export function addMistake(list: readonly Mistake[], mistake: Mistake): Mistake[] {
  const rest = list.filter((m) => keyOf(m) !== keyOf(mistake))
  return [mistake, ...rest].slice(0, MAX_MISTAKES)
}

export function removeMistake(
  list: readonly Mistake[],
  mistake: Pick<Mistake, 'players' | 'choices' | 'hand'>,
): Mistake[] {
  return list.filter((m) => keyOf(m) !== keyOf(mistake))
}

export function mistakeOf(players: number, question: PreflopQuestion): Mistake {
  return { players, choices: question.choices, hand: question.hand, cards: question.cards }
}

/** 間違えた場面をもう一度出す。データが変わってその手番に来なくなったものは出さない */
export function questionFromMistake(solution: PreflopSolution, mistake: Mistake): PreflopQuestion | null {
  if (mistake.players !== solution.positions.length) return null
  const walk = walkPreflop(solution, mistake.choices)
  if (walk.status !== 'deciding') return null
  return { choices: mistake.choices, walk, hand: mistake.hand, cards: mistake.cards }
}

/** 保存された値から、形の崩れていないものだけを残す */
export function normalizeMistakes(saved: unknown): Mistake[] {
  if (!Array.isArray(saved)) return []
  return saved.filter(
    (m): m is Mistake =>
      typeof m?.players === 'number' &&
      Array.isArray(m.choices) &&
      typeof m.hand === 'string' &&
      Array.isArray(m.cards) &&
      m.cards.length === 2,
  )
}
