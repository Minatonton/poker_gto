import { useState, type ReactNode } from 'react'
import type { HandClass } from '../poker/hands'
import type { Strategy } from '../poker/strategy'
import type { HandStats } from '../solver/aggregate'
import { RangeGrid } from './RangeGrid'
import { StrategyPanel } from './StrategyPanel'

interface Props {
  strategy: Strategy
  stats?: Map<HandClass, HandStats>
  /** 自分の手番のときの自分のハンド。最初から選択した状態にする */
  heroHand?: HandClass | null
  /** 右側の詳細の上に差し込む内容 */
  aside?: ReactNode
}

/** レンジグリッドと右側の詳細。ノードが変わったら key で作り直して選択状態を消す想定 */
export function StudyView({ strategy, stats, heroHand = null, aside }: Props) {
  const [hoveredHand, setHoveredHand] = useState<HandClass | null>(null)
  const [selectedHand, setSelectedHand] = useState<HandClass | null>(heroHand)
  const [focusedAction, setFocusedAction] = useState<number | null>(null)

  return (
    <div className="study">
      <section className="card grid-card">
        <RangeGrid
          strategy={strategy}
          focusedAction={focusedAction}
          selectedHand={selectedHand}
          heroHand={heroHand}
          onHover={setHoveredHand}
          onSelect={setSelectedHand}
        />
      </section>
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
