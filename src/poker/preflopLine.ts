import { POSITIONS, walkPreflop, type Position, type PreflopSolution, type Walk } from './preflop'
import type { ActionKind } from './strategy'

/** オープンした人・応答した人とそのアクション・オープナーの対応、でプリフロップのラインを表す */
export interface PreflopLine {
  opener?: Position
  responder?: Position
  response?: 'call' | 'raise'
  openerReply?: ActionKind
}

const MAX_DECISIONS = POSITIONS.length * 2

/**
 * ラインに沿う choices を作る。間のプレイヤーはフォールドとして埋める。
 * データのないポジションは walkPreflop が自動でフォールドにするため、
 * 何番目の判断が誰になるかは実際に walkPreflop を進めて確かめている。
 * ラインが途中までしか決まっていなければ、決まっていない最初の判断の手前で止める。
 */
export function choicesForLine(solution: PreflopSolution, line: PreflopLine): ActionKind[] {
  const choices: ActionKind[] = []
  for (let i = 0; i < MAX_DECISIONS; i++) {
    const walk = walkPreflop(solution, choices)
    if (walk.status !== 'deciding') break
    const kind = nextChoice(walk, line)
    if (kind === null) break
    if (!walk.strategy.actions.some((a) => a.kind === kind)) {
      throw new Error(`${walk.position} は ${kind} を選べません`)
    }
    choices.push(kind)
  }
  return choices
}

function nextChoice(walk: Extract<Walk, { status: 'deciding' }>, line: PreflopLine): ActionKind | null {
  const raises = walk.steps.filter((s) => s.action.kind === 'raise').length
  const position = walk.position
  if (raises === 0) {
    if (!line.opener) return null
    return position === line.opener ? 'raise' : 'fold'
  }
  if (raises === 1) {
    if (!line.responder) return null
    if (position !== line.responder) return 'fold'
    return line.response ?? null
  }
  return line.openerReply ?? null
}

/** 辿ったラインを PreflopLine として読み取る。シチュエーションの選択欄の表示に使う */
export function lineOfWalk(walk: Walk): PreflopLine {
  const decided = walk.steps.filter((s) => s.strategy !== null)
  const openIndex = decided.findIndex((s) => s.action.kind === 'raise')
  if (openIndex === -1) return {}
  const opener = decided[openIndex].position
  const after = decided.slice(openIndex + 1)
  const responseIndex = after.findIndex((s) => s.action.kind !== 'fold')
  if (responseIndex === -1) return { opener }
  const { position: responder, action } = after[responseIndex]
  const response = action.kind === 'raise' ? 'raise' : 'call'
  const reply = after.slice(responseIndex + 1).find((s) => s.position === opener)
  return { opener, responder, response, openerReply: reply?.action.kind }
}
