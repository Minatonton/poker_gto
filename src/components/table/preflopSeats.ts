import type { Position, Step } from '../../poker/preflop'
import { dealerOf, seatOf, seatsFromBottom, tableState } from '../../poker/table'
import { actionColor } from '../actionColors'
import type { SeatView } from './PokerTable'

/** プリフロップの履歴から卓の各席の表示を作る。自分の席が手前に来るように並べる */
export function preflopSeats(
  steps: readonly Step[],
  positions: readonly Position[],
  actor: Position | null,
  heroPosition: Position | null,
  heroCards: [string, string] | null,
): { seats: SeatView[]; pot: number } {
  const state = tableState(steps, positions)
  const dealer = dealerOf(positions)
  const seats = seatsFromBottom(positions, heroPosition ?? dealer).map((position) => {
    const seat = seatOf(state, position)
    return {
      position,
      dealer: position === dealer,
      stack: seat.stack,
      bet: seat.invested,
      folded: seat.folded,
      acting: position === actor,
      hero: position === heroPosition,
      cards: position === heroPosition ? heroCards : null,
      lastAction:
        seat.lastAction && !seat.autoFolded
          ? { label: seat.lastAction.label, color: actionColor(seat.lastAction) }
          : undefined,
    }
  })
  return { seats, pot: state.pot }
}
