import { overallFrequencies, type Strategy } from '../poker/strategy'
import { actionColor, formatPercent } from './actionColors'

interface Props {
  actor: string
  strategy: Strategy
  onChoose: (actionIndex: number) => void
}

/** 手番のプレイヤーと選べるアクション。ボタンの下の帯で全体の頻度を示す */
export function DecisionBar({ actor, strategy, onChoose }: Props) {
  const overall = overallFrequencies(strategy)
  return (
    <div className="decision">
      <span className="decision-actor">{actor}</span>
      <div className="decision-choices">
        {strategy.actions.map((action, index) => (
          <button
            key={action.label}
            className="choice"
            style={{ '--action': actionColor(action) } as React.CSSProperties}
            onClick={() => onChoose(index)}
          >
            <span className="choice-label">{action.label}</span>
            <span className="choice-freq">{formatPercent(overall[index])}</span>
            <span className="choice-bar" style={{ width: `${overall[index] * 100}%` }} />
          </button>
        ))}
      </div>
    </div>
  )
}
