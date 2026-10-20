import type { Position, Step } from './preflop'
import type { Action } from './strategy'

export const STARTING_STACK_BB = 100
const BLINDS: Partial<Record<Position, number>> = { SB: 0.5, BB: 1 }

export interface SeatState {
  position: Position
  /** このハンドで出したチップ（bb） */
  invested: number
  stack: number
  folded: boolean
  lastAction: Action | null
  /** データがないため自動でフォールド扱いにした */
  autoFolded: boolean
}

export interface TableState {
  /** 卓にいる席だけを持つ。席の取り出しは seatOf を使う */
  seats: Partial<Record<Position, SeatState>>
  pot: number
  /** いま最も高いベット額（bb）。コールに必要な額の基準 */
  currentBet: number
}

/** プリフロップのアクションの履歴から、テーブルの各席の状態を求める */
export function tableState(steps: readonly Step[], positions: readonly Position[]): TableState {
  const seats = Object.fromEntries(
    positions.map((position) => {
      const invested = BLINDS[position] ?? 0
      return [
        position,
        { position, invested, stack: STARTING_STACK_BB - invested, folded: false, lastAction: null, autoFolded: false },
      ]
    }),
  ) as TableState['seats']

  let currentBet = BLINDS.BB ?? 1
  for (const step of steps) {
    const seat = seats[step.position]
    if (!seat) continue
    seat.lastAction = step.action
    if (step.action.kind === 'fold') {
      seat.folded = true
      seat.autoFolded = step.strategy === null
    } else if (step.action.kind === 'call') {
      seat.invested = currentBet
    } else if (step.action.amount !== undefined) {
      seat.invested = step.action.amount
      currentBet = step.action.amount
    }
    seat.stack = STARTING_STACK_BB - seat.invested
  }

  const pot = Object.values(seats).reduce((sum, seat) => sum + (seat?.invested ?? 0), 0)
  return { seats, pot, currentBet }
}

export function seatOf(state: TableState, position: Position): SeatState {
  const seat = state.seats[position]
  if (!seat) throw new Error(`${position} はこの卓にいません`)
  return seat
}

/** 卓の席を、指定した席がテーブルの手前（下）に来るように時計回りに並べ替える */
export function seatsFromBottom(positions: readonly Position[], bottom: Position): Position[] {
  const start = Math.max(0, positions.indexOf(bottom))
  return positions.map((_, i) => positions[(start + i) % positions.length])
}

/** ディーラーボタンの席。ヘッズアップでは SB がボタンを兼ねる */
export function dealerOf(positions: readonly Position[]): Position {
  return positions.includes('BTN') ? 'BTN' : 'SB'
}
