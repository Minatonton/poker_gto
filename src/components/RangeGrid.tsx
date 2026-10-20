import { HAND_GRID, type HandClass } from '../poker/hands'
import type { Strategy } from '../poker/strategy'
import { ACTION_COLORS } from './actionColors'

interface Props {
  strategy: Strategy
  /** 指定すると、そのアクションの頻度だけを色付けして表示する */
  focusedAction: number | null
  onHover: (hand: HandClass | null) => void
}

export function RangeGrid({ strategy, focusedAction, onHover }: Props) {
  return (
    <div className="range-grid" onMouseLeave={() => onHover(null)}>
      {HAND_GRID.flat().map((hand) => (
        <div
          key={hand}
          className="range-cell"
          style={{ background: cellBackground(strategy, hand, focusedAction) }}
          onMouseEnter={() => onHover(hand)}
        >
          {hand}
        </div>
      ))}
    </div>
  )
}

/** 頻度の比率で左から色を塗り分ける */
function cellBackground(strategy: Strategy, hand: HandClass, focusedAction: number | null): string {
  const frequencies = strategy.frequencies.get(hand) ?? []
  const stops: string[] = []
  let position = 0
  frequencies.forEach((frequency, index) => {
    if (frequency === 0) return
    const color =
      focusedAction === null || focusedAction === index
        ? ACTION_COLORS[strategy.actions[index].kind]
        : 'var(--cell-muted)'
    const end = position + frequency * 100
    stops.push(`${color} ${position}% ${end}%`)
    position = end
  })
  return `linear-gradient(to right, ${stops.join(', ')})`
}
