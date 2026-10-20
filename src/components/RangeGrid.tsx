import { HAND_GRID, type HandClass } from '../poker/hands'
import type { Strategy } from '../poker/strategy'
import { actionColor } from './actionColors'

interface Props {
  strategy: Strategy
  /** 指定すると、そのアクションの頻度だけを色付けして表示する */
  focusedAction: number | null
  selectedHand: HandClass | null
  heroHand: HandClass | null
  onHover: (hand: HandClass | null) => void
  onSelect: (hand: HandClass | null) => void
}

/** 塗りが左上のラベルまで届かないセルでは、白い文字が背景に埋もれるため濃い文字にする */
const LABEL_ON_FILL_MIN_WEIGHT = 0.75

export function RangeGrid({ strategy, focusedAction, selectedHand, heroHand, onHover, onSelect }: Props) {
  return (
    <div className="range-grid" onMouseLeave={() => onHover(null)}>
      {HAND_GRID.flat().map((hand) => {
        const weight = strategy.weights?.get(hand) ?? 1
        const labelOnBackground = weight < LABEL_ON_FILL_MIN_WEIGHT
        return (
          <button
            key={hand}
            className={`range-cell ${weight === 0 ? 'unreached' : labelOnBackground ? 'partial' : ''} ${selectedHand === hand ? 'selected' : ''} ${heroHand === hand ? 'hero' : ''}`}
            onMouseEnter={() => onHover(hand)}
            onFocus={() => onHover(hand)}
            onClick={() => onSelect(selectedHand === hand ? null : hand)}
            aria-label={hand}
          >
            <span
              className="range-fill"
              style={{ height: `${weight * 100}%`, background: cellBackground(strategy, hand, focusedAction) }}
            />
            <span className="range-label">{hand}</span>
            {heroHand === hand && <span className="hero-mark" aria-label="自分のハンド" />}
          </button>
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
      focusedAction === null || focusedAction === index ? actionColor(strategy.actions[index]) : 'var(--cell-dimmed)'
    const end = position + frequency * 100
    stops.push(`${color} ${position}% ${end}%`)
    position = end
  })
  return stops.length === 0 ? 'transparent' : `linear-gradient(to right, ${stops.join(', ')})`
}
