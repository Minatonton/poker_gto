import { comboCount, type HandClass } from '../poker/hands'
import { overallFrequencies, reachingCombos, type Strategy } from '../poker/strategy'
import type { HandStats } from '../solver/aggregate'
import { actionColor, formatPercent } from './actionColors'

interface Props {
  strategy: Strategy
  hoveredHand: HandClass | null
  focusedAction: number | null
  onFocusAction: (index: number | null) => void
  /** ソルブ結果のときだけ EV とエクイティを表示する */
  stats?: Map<HandClass, HandStats>
}

export function StrategyPanel({ strategy, hoveredHand, focusedAction, onFocusAction, stats }: Props) {
  const overall = overallFrequencies(strategy)
  const combos = reachingCombos(strategy)
  const handFrequencies = hoveredHand ? strategy.frequencies.get(hoveredHand) : undefined
  const handWeight = hoveredHand ? (strategy.weights?.get(hoveredHand) ?? 1) : 0
  const handStats = hoveredHand ? stats?.get(hoveredHand) : undefined

  return (
    <aside className="strategy-panel">
      <section>
        <h2>全体の頻度（{combos.toFixed(1)} combos）</h2>
        <p className="hint">クリックするとそのアクションだけを表示します</p>
        {strategy.actions.map((action, index) => (
          <button
            key={action.label}
            className={`summary-row ${focusedAction === index ? 'focused' : ''}`}
            onClick={() => onFocusAction(focusedAction === index ? null : index)}
          >
            <span className="swatch" style={{ background: actionColor(action) }} />
            <span className="summary-label">{action.label}</span>
            <span className="summary-value">{formatPercent(overall[index])}</span>
            <span className="summary-combos">{(overall[index] * combos).toFixed(1)} combos</span>
          </button>
        ))}
      </section>

      <section>
        <h2>
          {hoveredHand
            ? `${hoveredHand}（${(comboCount(hoveredHand) * handWeight).toFixed(2)} combos）`
            : 'ハンド詳細'}
        </h2>
        {handFrequencies && handWeight > 0 ? (
          <>
            {strategy.actions.map((action, index) => (
              <div key={action.label} className="hand-row">
                <span className="swatch" style={{ background: actionColor(action) }} />
                <span className="summary-label">{action.label}</span>
                <span className="summary-value">{formatPercent(handFrequencies[index])}</span>
              </div>
            ))}
            {handStats && (
              <dl className="hand-stats">
                <dt>EV</dt>
                <dd>{handStats.ev.toFixed(2)}bb</dd>
                <dt>Equity</dt>
                <dd>{formatPercent(handStats.equity)}</dd>
              </dl>
            )}
          </>
        ) : (
          <p className="hint">
            {hoveredHand ? 'このハンドはこのノードに到達しません' : 'グリッドのハンドにカーソルを合わせてください'}
          </p>
        )}
      </section>
    </aside>
  )
}
