import type { ReactNode } from 'react'
import type { Position } from '../../poker/preflop'
import { BoardCards, PlayingCard } from '../postflop/Cards'

export interface SeatView {
  position: Position
  /** ディーラーボタンを置く席 */
  dealer?: boolean
  /** null はこのハンドに参加していない席 */
  stack: number | null
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

const CROWDED_SEATS = 8

const formatBb = (bb: number) => `${Number(bb.toFixed(2))}`

/**
 * 席を楕円の周りに等間隔で並べる。手前（下）を起点に、画面の左回り（プレイヤーから見て時計回り）に置く。
 * 返すのは卓の左上を 0、右下を 100 とした割合
 */
function seatPoint(slot: number, count: number, radiusX = 41, radiusY = 41) {
  const angle = Math.PI / 2 + (slot * 2 * Math.PI) / count
  return {
    x: 50 + radiusX * Math.cos(angle),
    y: 50 + radiusY * Math.sin(angle),
  }
}

export function PokerTable({ seats, pot, board, onSeatClick, center }: Props) {
  return (
    <div className={`poker-table ${seats.length >= CROWDED_SEATS ? 'crowded' : ''}`}>
      <div className="table-felt">
        <div className="table-center">
          {board && board.length > 0 && <BoardCards cards={board} />}
          <span className="table-pot">
            ポット <strong className="num">{formatBb(pot)}bb</strong>
          </span>
          {center}
        </div>
      </div>
      {seats.map((seat, slot) => {
        if (seat.bet <= 0) return null
        // チップは席と卓の中央の間に置く
        const { x, y } = seatPoint(slot, seats.length, 25, 22)
        return (
          <span key={`bet-${seat.position}`} className="seat-bet" style={{ left: `${x}%`, top: `${y}%` }}>
            <span className="chip" aria-hidden />
            <span className="num">{formatBb(seat.bet)}</span>
          </span>
        )
      })}
      {seats.map((seat, slot) => {
        const { x, y } = seatPoint(slot, seats.length)
        return (
          <div key={seat.position} className="seat-slot" style={{ left: `${x}%`, top: `${y}%` }}>
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
                  {seat.dealer && <span className="dealer-button">D</span>}
                </span>
                <span className="seat-stack num">
                  {seat.stack === null ? 'フォールド' : `${formatBb(seat.stack)}bb`}
                </span>
              </span>
              {seat.lastAction && (
                <span className="seat-action" style={{ color: seat.lastAction.color }}>
                  {seat.lastAction.label}
                </span>
              )}
              {seat.hero && <span className="seat-you">あなた</span>}
            </button>
          </div>
        )
      })}
    </div>
  )
}
