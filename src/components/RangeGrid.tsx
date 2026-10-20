import { HAND_GRID, type HandClass } from '../poker/hands'
import type { Strategy } from '../poker/strategy'
import { actionColor } from './actionColors'

interface Props {
  strategy: Strategy
  /** 指定すると、そのアクションの頻度だけを色付けして表示する */
  focusedAction: number | null
  onHover: (hand: HandClass | null) => void
}

export function RangeGrid({ strategy, focusedAction, onHover }: Props) {
  return (
    <div className="range-grid" onMouseLeave={() => onHover(null)}>
      {HAND_GRID.flat().map((hand) => {
        const weight = strategy.weights?.get(hand) ?? 1
        return (
          <div key={hand} className="range-cell" onMouseEnter={() => onHover(hand)}>
            <div
              className="range-fill"
              style={{ height: `${weight * 100}%`, background: cellBackground(strategy, hand, focusedAction) }}
            />
            <span className="range-label">{hand}</span>
          </div>
        )
      })}
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
      focusedAction === null || focusedAction === index ? actionColor(strategy.actions[index]) : 'var(--cell-muted)'
    const end = position + frequency * 100
    stops.push(`${color} ${position}% ${end}%`)
    position = end
  })
  return stops.length === 0 ? 'transparent' : `linear-gradient(to right, ${stops.join(', ')})`
}
