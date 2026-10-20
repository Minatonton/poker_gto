import { useState } from 'react'
import type { HandClass } from '../poker/hands'
import type { Strategy } from '../poker/strategy'
import type { HandStats } from '../solver/aggregate'
import { RangeGrid } from './RangeGrid'
import { StrategyPanel } from './StrategyPanel'

interface Props {
  strategy: Strategy
  stats?: Map<HandClass, HandStats>
}

/** レンジグリッドと右側の詳細。ノードが変わったら key で作り直して選択状態を消す想定 */
export function StudyView({ strategy, stats }: Props) {
  const [hoveredHand, setHoveredHand] = useState<HandClass | null>(null)
  const [selectedHand, setSelectedHand] = useState<HandClass | null>(null)
  const [focusedAction, setFocusedAction] = useState<number | null>(null)

  return (
    <div className="study">
      <section className="card grid-card">
        <RangeGrid
          strategy={strategy}
          focusedAction={focusedAction}
          selectedHand={selectedHand}
          onHover={setHoveredHand}
          onSelect={setSelectedHand}
        />
      </section>
      <StrategyPanel
        strategy={strategy}
        stats={stats}
        hoveredHand={hoveredHand}
        selectedHand={selectedHand}
        focusedAction={focusedAction}
        onFocusAction={setFocusedAction}
      />
    </div>
  )
}
