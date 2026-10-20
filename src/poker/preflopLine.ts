import { walkPreflop, type Position, type PreflopSolution, type Walk } from './preflop'
import type { ActionKind } from './strategy'

/**
 * オープンした人・応答した人とそのアクション・さらに応じた人とそのアクション・3ベットやスクイーズへの対応、
 * でプリフロップのラインを表す。名前のない人はフォールドしたものとする
 */
export interface PreflopLine {
  opener?: Position
  responder?: Position
  response?: 'call' | 'raise'
  /** 応答した人がコールしたとき、その後ろでさらに応じた人（オーバーコールまたはスクイーズ） */
  overcaller?: Position
  overcallAction?: 'call' | 'raise'
  openerReply?: ActionKind
  /** スクイーズされたときの、最初にコールした人の対応 */
  callerReply?: ActionKind
}


/**
 * ラインに沿う choices を作る。間のプレイヤーはフォールドとして埋める。
 * データのないポジションは walkPreflop が自動でフォールドにするため、
 * 何番目の判断が誰になるかは実際に walkPreflop を進めて確かめている。
 * ラインが途中までしか決まっていなければ、決まっていない最初の判断の手前で止める。
 */
export function choicesForLine(solution: PreflopSolution, line: PreflopLine): ActionKind[] {
  const choices: ActionKind[] = []
  // 1人あたり最大2回（最初の判断と、3ベットやスクイーズへの対応）
  for (let i = 0; i < solution.positions.length * 2; i++) {
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
    const someoneCalled = walk.steps.some((s) => s.action.kind === 'call')
    if (!someoneCalled) {
      if (!line.responder) return null
      if (position !== line.responder) return 'fold'
      return line.response ?? null
    }
    if (position !== line.overcaller) return 'fold'
    return line.overcallAction ?? null
  }
  if (position === line.opener) return line.openerReply ?? null
  return line.callerReply ?? null
}

/** 辿ったラインを PreflopLine として読み取る。シチュエーションの選択欄の表示に使う */
export function lineOfWalk(walk: Walk): PreflopLine {
  const decided = walk.steps.filter((s) => s.strategy !== null)
  const openIndex = decided.findIndex((s) => s.action.kind === 'raise')
  if (openIndex === -1) return {}
  const opener = decided[openIndex].position
  const line: PreflopLine = { opener }

  let rest = decided.slice(openIndex + 1)
  const responseIndex = rest.findIndex((s) => s.action.kind !== 'fold')
  if (responseIndex === -1) return line
  line.responder = rest[responseIndex].position
  line.response = rest[responseIndex].action.kind === 'raise' ? 'raise' : 'call'
  rest = rest.slice(responseIndex + 1)

  if (line.response === 'call') {
    const overIndex = rest.findIndex((s) => s.action.kind !== 'fold' && s.position !== opener)
    if (overIndex !== -1 && rest[overIndex].position !== line.responder) {
      line.overcaller = rest[overIndex].position
      line.overcallAction = rest[overIndex].action.kind === 'raise' ? 'raise' : 'call'
      rest = rest.slice(overIndex + 1)
    }
  }

  const reply = (position: Position) => rest.find((s) => s.position === position)?.action.kind
  const openerReply = reply(opener)
  if (openerReply) line.openerReply = openerReply
  if (line.overcallAction === 'raise') {
    const callerReply = reply(line.responder)
    if (callerReply) line.callerReply = callerReply
  }
  return line
}
