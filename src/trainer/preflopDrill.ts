import { walkPreflop, type Position, type PreflopSolution, type Walk } from '../poker/preflop'
import { choicesForLine, type PreflopLine } from '../poker/preflopLine'
import type { ActionKind } from '../poker/strategy'
import { dealFromRange } from './sampling'

export type PreflopDrillKind = 'rfi' | 'vsOpen' | 'vs3bet' | 'squeeze'

export const PREFLOP_DRILLS: { kind: PreflopDrillKind; label: string }[] = [
  { kind: 'rfi', label: 'オープン' },
  { kind: 'vsOpen', label: 'オープンへの対応' },
  { kind: 'vs3bet', label: '3ベットへの対応' },
  { kind: 'squeeze', label: 'コールが入った後' },
]

export interface PreflopQuestion {
  choices: ActionKind[]
  walk: Extract<Walk, { status: 'deciding' }>
  hand: string
  cards: [string, string]
}

const pick = <T>(items: readonly T[], random: () => number): T | undefined =>
  items[Math.floor(random() * items.length)]

/**
 * 出題する手番まで進めるラインを作る。hero を指定すると、その席が手番になるラインだけを選ぶ。
 * 条件に合うラインがない組み合わせ（例: UTG にコールが入った後の手番は来ない）では null
 */
export function drillChoices(
  solution: PreflopSolution,
  kind: PreflopDrillKind,
  hero: Position | null,
  random = Math.random,
): ActionKind[] | null {
  const positions = solution.positions
  const openers = positions.filter((p) => solution.rfi[p])
  if (kind === 'rfi') {
    const opener = hero ?? pick(openers, random)
    if (!opener || !solution.rfi[opener]) return null
    const foldsBefore = openers.filter((p) => positions.indexOf(p) < positions.indexOf(opener)).length
    return Array<ActionKind>(foldsBefore).fill('fold')
  }

  const lines: PreflopLine[] = []
  for (const opener of openers) {
    for (const responder of positions.filter((p) => solution.vsOpen[opener]?.[p])) {
      if (kind === 'vsOpen') lines.push({ opener, responder })
      if (kind === 'vs3bet' && solution.vs3bet[opener]?.[responder]) {
        lines.push({ opener, responder, response: 'raise' })
      }
      if (kind === 'squeeze' && solution.vsOpen[opener]?.[responder]?.call) {
        const after = positions.slice(positions.indexOf(responder) + 1)
        for (const overcaller of after.filter((p) => solution.vsOpenCall?.[p])) {
          lines.push({ opener, responder, response: 'call', overcaller })
        }
      }
    }
  }
  const candidates = lines.filter((line) => {
    if (!hero) return true
    const actor = kind === 'vsOpen' ? line.responder : kind === 'vs3bet' ? line.opener : line.overcaller
    return actor === hero
  })
  const line = pick(candidates, random)
  return line ? choicesForLine(solution, line) : null
}

/** 手番まで進め、そのプレイヤーがここに到達する割合に沿って手札を配る */
export function createPreflopQuestion(
  solution: PreflopSolution,
  kind: PreflopDrillKind,
  hero: Position | null,
  random = Math.random,
): PreflopQuestion | null {
  const choices = drillChoices(solution, kind, hero, random)
  if (!choices) return null
  const walk = walkPreflop(solution, choices)
  if (walk.status !== 'deciding') return null
  const dealt = dealFromRange(walk.strategy.weights ?? new Map(), new Set(), random)
  if (!dealt) return null
  return { choices, walk, hand: dealt.hand, cards: dealt.cards }
}
