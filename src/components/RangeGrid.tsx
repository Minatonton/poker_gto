import { HAND_GRID, type HandClass } from '../poker/hands'
import type { Strategy } from '../poker/strategy'
import type { HandStats } from '../solver/aggregate'
import { actionColor } from './actionColors'

/**
 * グリッドの色で何を表すか。EV と EQ はソルブ結果のときだけ選べる。
 * range は最初のアクションの頻度だけを無彩色で塗る。アクションのないレンジを見せるときに、
 * 赤や青がアクションの意味に読まれてしまわないようにするため
 */
export type GridMode = 'strategy' | 'ev' | 'equity' | 'range'

interface Props {
  strategy: Strategy
  mode: GridMode
  stats?: Map<HandClass, HandStats>
  /** EV の色の基準にするポット（bb） */
  potBb?: number
  /** 指定すると、そのアクションの頻度だけを色付けして表示する */
  focusedAction: number | null
  selectedHand: HandClass | null
  heroHand: HandClass | null
  onHover: (hand: HandClass | null) => void
  onSelect: (hand: HandClass | null) => void
  /** セルを押し始めたとき。ドラッグで塗るときに使う */
  onCellDown?: (hand: HandClass) => void
  /** 印を付けるハンド（答え合わせで間違えたハンドなど） */
  markedHands?: ReadonlySet<HandClass>
}

/** 塗りが左上のラベルまで届かないセルでは、白い文字が背景に埋もれるため濃い文字にする */
const LABEL_ON_FILL_MIN_WEIGHT = 0.75

export function RangeGrid({
  strategy,
  mode,
  stats,
  potBb = 1,
  focusedAction,
  selectedHand,
  heroHand,
  onHover,
  onSelect,
  onCellDown,
  markedHands,
}: Props) {
  return (
    <div className={`range-grid ${onCellDown ? 'paintable' : ''}`} onMouseLeave={() => onHover(null)}>
      {HAND_GRID.flat().map((hand) => {
        const weight =
          mode === 'range' ? (strategy.frequencies.get(hand)?.[0] ?? 0) : (strategy.weights?.get(hand) ?? 1)
        const labelOnBackground = weight < LABEL_ON_FILL_MIN_WEIGHT
        const handStats = stats?.get(hand)
        const background =
          mode === 'range'
            ? 'var(--range-fill)'
            : mode === 'strategy' || !handStats
            ? strategyBackground(strategy, hand, focusedAction)
            : heatColor(mode === 'equity' ? handStats.equity : handStats.ev / potBb)
        return (
          <button
            key={hand}
            className={`range-cell ${weight === 0 ? 'unreached' : labelOnBackground ? 'partial' : ''} ${selectedHand === hand ? 'selected' : ''} ${heroHand === hand ? 'hero' : ''} ${markedHands?.has(hand) ? 'marked' : ''}`}
            onMouseDown={onCellDown ? (e) => {
              e.preventDefault()
              onCellDown(hand)
            } : undefined}
            onMouseEnter={() => onHover(hand)}
            onFocus={() => onHover(hand)}
            onClick={() => onSelect(selectedHand === hand ? null : hand)}
            aria-label={hand}
          >
            <span className="range-fill" style={{ height: `${weight * 100}%`, background }} />
            <span className="range-label">
              {hand}
              {(mode === 'ev' || mode === 'equity') && handStats && (
                <span className="range-value">
                  {mode === 'equity' ? Math.round(handStats.equity * 100) : handStats.ev.toFixed(1)}
                </span>
              )}
            </span>
            {heroHand === hand && <span className="hero-mark" aria-label="自分のハンド" />}
          </button>
        )
      })}
    </div>
  )
}

/** 頻度の比率で左から色を塗り分ける */
function strategyBackground(strategy: Strategy, hand: HandClass, focusedAction: number | null): string {
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

/**
 * 0〜1 を赤（低い）から緑（高い）へ。EV はポットに対する割合で渡すので、
 * ポットを丸ごと取れるハンドが緑、ほとんど取れないハンドが赤になる
 */
function heatColor(ratio: number): string {
  const clamped = Math.min(1, Math.max(0, ratio))
  return `hsl(${Math.round(clamped * 130)} 48% 36%)`
}
