import { useState } from 'react'
import { SUITS, cardFromId } from '../../poker/cards'
import { PlayingCard } from '../postflop/Cards'

const RANK_IDS_DESC = Array.from({ length: 13 }, (_, i) => 12 - i)

interface Props {
  title: string
  /** 選ぶ枚数 */
  count: number
  initial?: string[]
  /** 選べないカード（手札やボードと重なるもの） */
  unavailable?: string[]
  onDone: (cards: string[]) => void
  onCancel: () => void
  /** 指定すると、ランダムに配るボタンを出す */
  onRandom?: () => void
}

/** 卓の上に重ねて出す、カードを選ぶパネル。決まった枚数を選ぶと決定できる */
export function CardSelect({ title, count, initial = [], unavailable = [], onDone, onCancel, onRandom }: Props) {
  const [picked, setPicked] = useState<string[]>(initial.slice(0, count))

  const toggle = (card: string) => {
    if (picked.includes(card)) setPicked(picked.filter((c) => c !== card))
    else if (picked.length < count) setPicked([...picked, card])
    else setPicked([...picked.slice(1), card])
  }

  return (
    <div className="card-select" role="dialog" aria-label={title}>
      <div className="card-select-head">
        <strong>{title}</strong>
        <span className="card-select-picked">
          {Array.from({ length: count }, (_, i) =>
            picked[i] ? <PlayingCard key={picked[i]} card={picked[i]} /> : <span key={i} className="card-slot small" />,
          )}
        </span>
      </div>
      <div className="card-select-grid">
        {SUITS.map((_, suit) =>
          RANK_IDS_DESC.map((rank) => {
            const card = cardFromId(rank * 4 + suit)
            return (
              <button
                key={card}
                type="button"
                className={picked.includes(card) ? 'picked' : ''}
                disabled={unavailable.includes(card)}
                onClick={() => toggle(card)}
              >
                <PlayingCard card={card} />
              </button>
            )
          }),
        )}
      </div>
      <div className="finished-actions">
        <button type="button" className="btn primary" disabled={picked.length !== count} onClick={() => onDone(picked)}>
          決定
        </button>
        {onRandom && (
          <button type="button" className="btn" onClick={onRandom}>
            ランダムに配る
          </button>
        )}
        <button type="button" className="btn" onClick={onCancel}>
          閉じる
        </button>
      </div>
    </div>
  )
}
