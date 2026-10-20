import { comboCount, type HandClass } from '../poker/hands'
import { overallFrequencies, reachingCombos, type Strategy } from '../poker/strategy'
import type { HandStats } from '../solver/aggregate'
import { actionColor, formatPercent } from './actionColors'

interface Props {
  strategy: Strategy
  /** カーソルを合わせているハンド。なければ選択中のハンドを表示する */
  hoveredHand: HandClass | null
  selectedHand: HandClass | null
  focusedAction: number | null
  onFocusAction: (index: number | null) => void
  /** ソルブ結果のときだけ EV とエクイティを表示する */
  stats?: Map<HandClass, HandStats>
}

export function StrategyPanel({ strategy, hoveredHand, selectedHand, focusedAction, onFocusAction, stats }: Props) {
  const overall = overallFrequencies(strategy)
  const combos = reachingCombos(strategy)
  const hand = hoveredHand ?? selectedHand

  return (
    <aside className="strategy-panel">
      <section className="card">
        <header className="card-header">
          レンジ全体
          <span className="aside num">{combos.toFixed(1)} combos</span>
        </header>
        <div className="distribution" aria-hidden>
          {strategy.actions.map((action, index) => (
            <span key={action.label} style={{ width: `${overall[index] * 100}%`, background: actionColor(action) }} />
          ))}
        </div>
        <ul className="action-list">
          {strategy.actions.map((action, index) => (
            <li key={action.label}>
              <button
                className={`action-row ${focusedAction === index ? 'focused' : ''}`}
                aria-pressed={focusedAction === index}
                onClick={() => onFocusAction(focusedAction === index ? null : index)}
              >
                <span className="swatch" style={{ background: actionColor(action) }} />
                <span>{action.label}</span>
                <span className="num">{formatPercent(overall[index])}</span>
                <span className="num muted">{(overall[index] * combos).toFixed(1)}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="panel-note">行を押すと、そのアクションだけをグリッドに表示します</p>
      </section>

      <section className="card">
        {hand ? (
          <HandDetail hand={hand} strategy={strategy} stats={stats?.get(hand)} />
        ) : (
          <>
            <header className="card-header">ハンドの内訳</header>
            <p className="empty-note">ハンドにカーソルを合わせると内訳を表示します。クリックすると固定できます。</p>
          </>
        )}
      </section>
    </aside>
  )
}

function HandDetail({ hand, strategy, stats }: { hand: HandClass; strategy: Strategy; stats?: HandStats }) {
  const weight = strategy.weights?.get(hand) ?? 1
  const frequencies = strategy.frequencies.get(hand) ?? []
  return (
    <>
      <header className="card-header">
        <span className="hand-name">{hand}</span>
        <span className="aside num">{(comboCount(hand) * weight).toFixed(2)} combos</span>
      </header>
      {weight === 0 ? (
        <p className="empty-note">このハンドはこのノードに到達しません</p>
      ) : (
        <>
          <ul className="action-list">
            {stats && (
              <li className="action-row static with-ev head">
                <span />
                <span>アクション</span>
                <span className="num">頻度</span>
                <span className="num">EV</span>
              </li>
            )}
            {strategy.actions.map((action, index) => (
              <li key={action.label} className={`action-row static ${stats ? 'with-ev' : ''}`}>
                <span className="swatch" style={{ background: actionColor(action) }} />
                <span>{action.label}</span>
                <span className="num">{formatPercent(frequencies[index])}</span>
                {stats && <span className="num muted">{stats.actionEvs[index].toFixed(2)}</span>}
              </li>
            ))}
          </ul>
          {stats && (
            <dl className="hand-stats">
              <div>
                <dt>EV</dt>
                <dd className="num">{stats.ev.toFixed(2)}bb</dd>
              </div>
              <div>
                <dt>エクイティ</dt>
                <dd className="num">{formatPercent(stats.equity)}</dd>
              </div>
            </dl>
          )}
        </>
      )}
    </>
  )
}
