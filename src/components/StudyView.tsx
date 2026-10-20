import { useState, type ReactNode } from 'react'
import type { HandClass } from '../poker/hands'
import type { Strategy } from '../poker/strategy'
import type { HandStats } from '../solver/aggregate'
import { RangeGrid, type GridMode } from './RangeGrid'
import { Segmented } from './Segmented'
import { StrategyPanel } from './StrategyPanel'

interface Props {
  strategy: Strategy
  stats?: Map<HandClass, HandStats>
  /** EV の色の基準にするポット（bb） */
  potBb?: number
  /** 自分の手番のときの自分のハンド。最初から選択した状態にする */
  heroHand?: HandClass | null
  /** 右側の詳細の上に差し込む内容 */
  aside?: ReactNode
  /** グリッドの下に差し込む内容 */
  below?: ReactNode
}

const MODE_OPTIONS: { value: GridMode; label: string }[] = [
  { value: 'strategy', label: '戦略' },
  { value: 'ev', label: 'EV' },
  { value: 'equity', label: 'EQ' },
]

/** レンジグリッドと右側の詳細。ノードが変わったら key で作り直して選択状態を消す想定 */
export function StudyView({ strategy, stats, potBb, heroHand = null, aside, below }: Props) {
  const [hoveredHand, setHoveredHand] = useState<HandClass | null>(null)
  const [selectedHand, setSelectedHand] = useState<HandClass | null>(heroHand)
  const [focusedAction, setFocusedAction] = useState<number | null>(null)
  const [mode, setMode] = useState<GridMode>('strategy')

  return (
    <div className="study">
      <div className="study-main">
        <section className="card">
          {stats && (
            <header className="card-header">
              <Segmented label="表示" options={MODE_OPTIONS} value={mode} onChange={setMode} />
              {mode !== 'strategy' && (
                <span className="aside">
                  {mode === 'ev' ? 'セルの数字は EV（bb）。緑ほどポットを多く取れる' : 'セルの数字は EQ（%）'}
                </span>
              )}
            </header>
          )}
          <div className="grid-card">
            <RangeGrid
              strategy={strategy}
              mode={mode}
              stats={stats}
              potBb={potBb}
              focusedAction={focusedAction}
              selectedHand={selectedHand}
              heroHand={heroHand}
              onHover={setHoveredHand}
              onSelect={setSelectedHand}
            />
          </div>
        </section>
        {below}
      </div>
      <div className="study-side">
        {aside}
        <StrategyPanel
          strategy={strategy}
          stats={stats}
          hoveredHand={hoveredHand}
          selectedHand={selectedHand}
          focusedAction={focusedAction}
          onFocusAction={setFocusedAction}
        />
      </div>
    </div>
  )
}
