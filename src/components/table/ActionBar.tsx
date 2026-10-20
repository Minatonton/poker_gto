import type { HandClass } from '../../poker/hands'
import { overallFrequencies, type Strategy } from '../../poker/strategy'
import { actionColor, formatPercent } from '../actionColors'

interface Props {
  actor: string
  strategy: Strategy
  /** GTO の頻度をボタンに出すか。出さなければ実戦のように自分で判断してから答え合わせできる */
  showFrequencies: boolean
  onToggleFrequencies: () => void
  /** 手番が自分のとき、自分のハンドの頻度もボタンに出す */
  heroHand?: HandClass | null
  onChoose: (index: number) => void
}

/** 手番のプレイヤーのアクションボタン。ゲームの操作パネルのように大きく並べる */
export function ActionBar({ actor, strategy, showFrequencies, onToggleFrequencies, heroHand, onChoose }: Props) {
  const overall = overallFrequencies(strategy)
  const heroFrequencies = heroHand ? strategy.frequencies.get(heroHand) : undefined
  return (
    <div className="action-bar">
      <div className="action-bar-head">
        <span>
          <strong>{actor}</strong> のアクション
        </span>
        <label className="checkbox-row">
          <input type="checkbox" checked={showFrequencies} onChange={onToggleFrequencies} />
          GTO の頻度を表示
        </label>
      </div>
      <div className="action-buttons">
        {strategy.actions.map((action, index) => (
          <button
            key={action.label}
            className={`action-button kind-${action.kind}`}
            style={{ '--action': actionColor(action) } as React.CSSProperties}
            onClick={() => onChoose(index)}
          >
            <span className="action-button-label">{action.label}</span>
            {showFrequencies && (
              <span className="action-button-freq num">
                {heroFrequencies ? `${heroHand} ${formatPercent(heroFrequencies[index])}` : `レンジ ${formatPercent(overall[index])}`}
              </span>
            )}
            {showFrequencies && (
              <span
                className="action-button-bar"
                style={{ width: `${(heroFrequencies ? heroFrequencies[index] : overall[index]) * 100}%` }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
