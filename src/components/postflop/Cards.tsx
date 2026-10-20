import { SUITS, cardFromId } from '../../poker/cards'

const SUIT_SYMBOLS: Record<string, string> = { c: '♣', d: '♦', h: '♥', s: '♠' }

/** スートを色の面で見分けられる4色デッキ */
export function PlayingCard({ card }: { card: string }) {
  return (
    <span className={`playing-card suit-${card[1]}`} aria-label={card}>
      {card[0]}
      <small>{SUIT_SYMBOLS[card[1]]}</small>
    </span>
  )
}

export function BoardCards({ cards }: { cards: string[] }) {
  return (
    <span className="board-cards">
      {cards.map((card) => (
        <PlayingCard key={card} card={card} />
      ))}
    </span>
  )
}

const RANK_IDS_DESC = Array.from({ length: 13 }, (_, i) => 12 - i)

/** ターン・リバーで配るカードを選ぶ */
export function CardPicker({ possibleCards, onPick }: { possibleCards: number[]; onPick: (id: number) => void }) {
  const possible = new Set(possibleCards)
  return (
    <div className="card-picker">
      {SUITS.map((_, suit) =>
        RANK_IDS_DESC.map((rank) => {
          const id = rank * 4 + suit
          return (
            <button key={id} disabled={!possible.has(id)} onClick={() => onPick(id)}>
              <PlayingCard card={cardFromId(id)} />
            </button>
          )
        }),
      )}
    </div>
  )
}
