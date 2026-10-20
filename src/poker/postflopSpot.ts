import type { HandClass } from './hands'
import { rangeOfPosition, type Position, type Step, type Walk } from './preflop'

const STARTING_STACK_BB = 100
const BLINDS: Partial<Record<Position, number>> = { SB: 0.5, BB: 1 }
/**
 * ポストフロップで行動する順。ブラインドが先で、残りはプリフロップと同じ順。
 * ヘッズアップでは SB がボタンを兼ねるため、BB が先に行動する
 */
function postflopOrder(positions: readonly Position[]): readonly Position[] {
  if (positions.length === 2) return ['BB', 'SB']
  return ['SB', 'BB', ...positions.filter((p) => p !== 'SB' && p !== 'BB')]
}

export interface PostflopSpot {
  /** "BTN vs BB（シングルレイズドポット）" のような説明 */
  name: string
  oop: Position
  ip: Position
  oopRange: Map<HandClass, number>
  ipRange: Map<HandClass, number>
  potBb: number
  effectiveStackBb: number
  /** 卓の席。テーブルの表示に使う */
  positions: readonly Position[]
}

/** 2人でフロップに進んだプリフロップラインから、フロップ開始時のスポットを作る。3人以上はソルバーが扱えない */
export function spotFromWalk(walk: Walk): PostflopSpot | null {
  if (walk.status !== 'finished' || walk.flopPlayers.length !== 2) return null
  const order = postflopOrder(walk.positions)
  const [oop, ip] = [...walk.flopPlayers].sort((a, b) => order.indexOf(a) - order.indexOf(b))

  const invested = investments(walk.steps)
  const potBb = Object.values(invested).reduce((sum, bb) => sum + bb, 0)
  const raiseCount = walk.steps.filter((s) => s.action.kind === 'raise').length

  return {
    name: `${oop} vs ${ip}（${raiseCount >= 2 ? '3ベットポット' : 'シングルレイズドポット'}）`,
    oop,
    ip,
    oopRange: rangeOfPosition(walk.steps, oop),
    ipRange: rangeOfPosition(walk.steps, ip),
    potBb,
    effectiveStackBb: STARTING_STACK_BB - (invested[oop] ?? 0),
    positions: walk.positions,
  }
}

function investments(steps: Step[]): Partial<Record<Position, number>> {
  const invested: Partial<Record<Position, number>> = { ...BLINDS }
  let currentBet = BLINDS.BB ?? 1
  for (const { position, action } of steps) {
    if (action.kind === 'raise' && action.amount !== undefined) {
      invested[position] = action.amount
      currentBet = action.amount
    } else if (action.kind === 'call') {
      invested[position] = currentBet
    }
  }
  return invested
}

/** postflop-solver が解釈できるレンジ表記 "AA,AKs:0.5,..." にする */
export function toRangeNotation(range: Map<HandClass, number>): string {
  return [...range]
    .filter(([, weight]) => weight > 0)
    .map(([hand, weight]) => (weight >= 1 ? hand : `${hand}:${Number(weight.toFixed(4))}`))
    .join(',')
}
