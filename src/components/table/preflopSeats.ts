import type { Position, Step } from '../../poker/preflop'
import { seatsFromBottom, tableState } from '../../poker/table'
import { actionColor } from '../actionColors'
import type { SeatView } from './PokerTable'

/** プリフロップの履歴から卓の各席の表示を作る。自分の席が手前に来るように並べる */
export function preflopSeats(
  steps: readonly Step[],
  actor: Position | null,
  heroPosition: Position | null,
  heroCards: [string, string] | null,
): { seats: SeatView[]; pot: number } {
  const state = tableState(steps)
  const seats = seatsFromBottom(heroPosition ?? 'BTN').map((position) => {
    const seat = state.seats[position]
    return {
      position,
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
