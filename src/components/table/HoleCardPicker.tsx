import { useState } from 'react'
import { SUITS, cardFromId } from '../../poker/cards'
import { PlayingCard } from '../postflop/Cards'

const RANK_IDS_DESC = Array.from({ length: 13 }, (_, i) => 12 - i)

interface Props {
  initial: string[]
  /** 選べないカード（ボードなど） */
  unavailable?: string[]
  onDone: (cards: [string, string]) => void
  onCancel: () => void
}

/** 52枚から自分の手札を2枚クリックで選ぶ */
export function HoleCardPicker({ initial, unavailable = [], onDone, onCancel }: Props) {
  const [picked, setPicked] = useState<string[]>(initial.slice(0, 2))

  const toggle = (card: string) => {
    if (picked.includes(card)) setPicked(picked.filter((c) => c !== card))
    else if (picked.length < 2) setPicked([...picked, card])
    else setPicked([picked[1], card])
  }

  return (
    <div className="hole-card-picker">
      <div className="picker-head">
        <span>手札を2枚選んでください</span>
        <span className="picker-selected">
          {picked.map((card) => (
            <PlayingCard key={card} card={card} />
          ))}
        </span>
      </div>
      <div className="card-picker">
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
        <button
          type="button"
          className="btn primary"
          disabled={picked.length !== 2}
          onClick={() => onDone([picked[0], picked[1]])}
        >
          この手札にする
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </div>
  )
}
