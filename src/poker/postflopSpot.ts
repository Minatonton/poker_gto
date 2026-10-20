import { ALL_HANDS, type HandClass } from './hands'
import type { Position, Step, Walk } from './preflop'

const STARTING_STACK_BB = 100
const BLINDS: Partial<Record<Position, number>> = { SB: 0.5, BB: 1 }
const POSTFLOP_ORDER: readonly Position[] = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']

export interface PostflopSpot {
  /** "BTN vs BB（シングルレイズドポット）" のような説明 */
  name: string
  oop: Position
  ip: Position
  oopRange: Map<HandClass, number>
  ipRange: Map<HandClass, number>
  potBb: number
  effectiveStackBb: number
}

/** コールで終わったヘッズアップのプリフロップラインから、フロップ開始時のスポットを作る。 */
export function spotFromWalk(walk: Walk): PostflopSpot | null {
  if (walk.status !== 'finished') return null
  const lastStep = walk.steps.findLast((step) => step.strategy !== null)
  if (lastStep?.action.kind !== 'call') return null

  const players = [...new Set(walk.steps.filter((s) => s.action.kind !== 'fold').map((s) => s.position))]
  if (players.length !== 2) return null
  const [oop, ip] = [...players].sort((a, b) => POSTFLOP_ORDER.indexOf(a) - POSTFLOP_ORDER.indexOf(b))

  const invested = investments(walk.steps)
  const potBb = Object.values(invested).reduce((sum, bb) => sum + bb, 0)
  const raiseCount = walk.steps.filter((s) => s.action.kind === 'raise').length

  return {
    name: `${oop} vs ${ip}（${raiseCount >= 2 ? '3ベットポット' : 'シングルレイズドポット'}）`,
    oop,
    ip,
    oopRange: rangeOf(walk.steps, oop),
    ipRange: rangeOf(walk.steps, ip),
    potBb,
    effectiveStackBb: STARTING_STACK_BB - (invested[oop] ?? 0),
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

/** そのプレイヤーの各判断で、実際に選ばれたアクションの頻度を掛け合わせる */
function rangeOf(steps: Step[], position: Position): Map<HandClass, number> {
  const range = new Map<HandClass, number>(ALL_HANDS.map((hand) => [hand, 1]))
  for (const step of steps) {
    if (step.position !== position || step.strategy === null) continue
    const actionIndex = step.strategy.actions.indexOf(step.action)
    for (const hand of ALL_HANDS) {
      const frequency = step.strategy.frequencies.get(hand)?.[actionIndex] ?? 0
      range.set(hand, (range.get(hand) ?? 0) * frequency)
    }
  }
  return range
}

/** postflop-solver が解釈できるレンジ表記 "AA,AKs:0.5,..." にする */
export function toRangeNotation(range: Map<HandClass, number>): string {
  return [...range]
    .filter(([, weight]) => weight > 0)
    .map(([hand, weight]) => (weight >= 1 ? hand : `${hand}:${Number(weight.toFixed(4))}`))
    .join(',')
}
