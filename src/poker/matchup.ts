import { ALL_HANDS, type HandClass } from './hands'
import { rangeOfPosition, type Position, type Step } from './preflop'
import { seatOf, tableState } from './table'

export interface PreflopMatchup {
  /** EQ を測る相手。null なら、まだ誰もレイズしておらず特定の相手がいない */
  opponent: Position | null
  range: Map<HandClass, number>
  /** 真ん中にあるチップ全体（bb） */
  pot: number
  /** 自分がコールに足す額（bb）。0 なら払わずに続けられる */
  toCall: number
}

const ANY_HAND = new Map<HandClass, number>(ALL_HANDS.map((hand) => [hand, 1]))

/**
 * プリフロップで、自分の手札の EQ を誰のレンジと比べるか。
 * 相手は最後にレイズした人にする。コールしてきた人より、レイズした人のレンジが自分の判断を一番左右するため。
 * 誰もレイズしていなければ、どの手でも同じ重みのレンジ（ランダムな手）と比べる
 */
export function preflopMatchup(
  steps: readonly Step[],
  positions: readonly Position[],
  hero: Position,
): PreflopMatchup | null {
  const state = tableState(steps, positions)
  const seat = state.seats[hero]
  if (!seat || seat.folded) return null
  const raiser = steps.findLast((step) => step.action.kind === 'raise' && step.position !== hero)?.position ?? null
  return {
    opponent: raiser,
    range: raiser ? rangeOfPosition(steps, raiser) : ANY_HAND,
    pot: state.pot,
    toCall: Math.max(0, state.currentBet - seatOf(state, hero).invested),
  }
}
