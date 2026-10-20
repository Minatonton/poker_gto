import type { ReactNode } from 'react'
import type { Position } from '../../poker/preflop'
import { BoardCards, PlayingCard } from '../postflop/Cards'

export interface SeatView {
  position: Position
  stack: number
  /** 席の前に置かれたチップ（bb）。0 なら置かない */
  bet: number
  folded: boolean
  acting: boolean
  hero: boolean
  /** 表向きの手札。null なら手札を伏せて置く（フォールドした席は置かない） */
  cards: [string, string] | null
  /** 直前のアクションの表示 */
  lastAction?: { label: string; color: string }
}

interface Props {
  /** 手前（下）の席から時計回り */
  seats: SeatView[]
  pot: number
  board?: string[]
  onSeatClick?: (position: Position) => void
  /** テーブルの中央、ポットの下に出す内容 */
  center?: ReactNode
}

const formatBb = (bb: number) => `${Number(bb.toFixed(2))}`

export function PokerTable({ seats, pot, board, onSeatClick, center }: Props) {
  return (
    <div className="poker-table">
      <div className="table-felt">
        <div className="table-center">
          {board && board.length > 0 && <BoardCards cards={board} />}
          <span className="table-pot">
            ポット <strong className="num">{formatBb(pot)}bb</strong>
          </span>
          {center}
        </div>
      </div>
      {seats.map((seat, slot) => (
        <div key={seat.position} className={`seat-slot slot-${slot}`}>
          {seat.bet > 0 && (
            <span className={`seat-bet bet-${slot}`}>
              <span className="chip" aria-hidden />
              <span className="num">{formatBb(seat.bet)}</span>
            </span>
          )}
          <button
            type="button"
            className={`seat ${seat.folded ? 'folded' : ''} ${seat.acting ? 'acting' : ''} ${seat.hero ? 'hero' : ''}`}
            onClick={() => onSeatClick?.(seat.position)}
            title={seat.hero ? '自分の席（クリックで解除）' : 'クリックしてこの席に座る'}
          >
            {!seat.folded && (
              <span className="seat-cards">
                {seat.cards ? (
                  seat.cards.map((card) => <PlayingCard key={card} card={card} />)
                ) : (
                  <>
                    <span className="card-back" />
                    <span className="card-back" />
                  </>
                )}
              </span>
            )}
            <span className="seat-plate">
              <span className="seat-position">
                {seat.position}
                {seat.position === 'BTN' && <span className="dealer-button">D</span>}
              </span>
              <span className="seat-stack num">{formatBb(seat.stack)}bb</span>
            </span>
            {seat.lastAction && (
              <span className="seat-action" style={{ color: seat.lastAction.color }}>
                {seat.lastAction.label}
              </span>
            )}
            {seat.hero && <span className="seat-you">あなた</span>}
          </button>
        </div>
      ))}
    </div>
  )
}
