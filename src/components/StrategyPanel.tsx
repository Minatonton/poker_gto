import { TOTAL_COMBOS, comboCount, type HandClass } from '../poker/hands'
import { overallFrequencies, type Strategy } from '../poker/strategy'
import { ACTION_COLORS, formatPercent } from './actionColors'

interface Props {
  strategy: Strategy
  hoveredHand: HandClass | null
  focusedAction: number | null
  onFocusAction: (index: number | null) => void
}

export function StrategyPanel({ strategy, hoveredHand, focusedAction, onFocusAction }: Props) {
  const overall = overallFrequencies(strategy)
  const handFrequencies = hoveredHand ? strategy.frequencies.get(hoveredHand) : undefined

  return (
    <aside className="strategy-panel">
      <section>
        <h2>全体の頻度</h2>
        <p className="hint">クリックするとそのアクションだけを表示します</p>
        {strategy.actions.map((action, index) => (
          <button
            key={action.kind}
            className={`summary-row ${focusedAction === index ? 'focused' : ''}`}
            onClick={() => onFocusAction(focusedAction === index ? null : index)}
          >
            <span className="swatch" style={{ background: ACTION_COLORS[action.kind] }} />
            <span className="summary-label">{action.label}</span>
            <span className="summary-value">{formatPercent(overall[index])}</span>
            <span className="summary-combos">{(overall[index] * TOTAL_COMBOS).toFixed(1)} combos</span>
          </button>
        ))}
      </section>

      <section>
        <h2>{hoveredHand ? `${hoveredHand}（${comboCount(hoveredHand)} combos）` : 'ハンド詳細'}</h2>
        {handFrequencies ? (
          strategy.actions.map((action, index) => (
            <div key={action.kind} className="hand-row">
              <span className="swatch" style={{ background: ACTION_COLORS[action.kind] }} />
              <span className="summary-label">{action.label}</span>
              <span className="summary-value">{formatPercent(handFrequencies[index])}</span>
            </div>
          ))
        ) : (
          <p className="hint">グリッドのハンドにカーソルを合わせてください</p>
        )}
      </section>
    </aside>
  )
}
