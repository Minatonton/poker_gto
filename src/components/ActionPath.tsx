import type { Walk } from '../poker/preflop'
import { overallFrequencies, type ActionKind } from '../poker/strategy'
import { actionColor, formatPercent } from './actionColors'

interface Props {
  walk: Walk
  /** 何番目の意思決定まで巻き戻すか */
  onRewind: (choiceCount: number) => void
  onChoose: (kind: ActionKind) => void
}

export function ActionPath({ walk, onRewind, onChoose }: Props) {
  let choiceCount = 0
  return (
    <div className="action-path">
      {walk.steps.map((step, index) => {
        const rewindTo = choiceCount
        const auto = step.strategy === null
        if (!auto) choiceCount++
        return (
          <button
            key={index}
            className={`path-card ${auto ? 'auto' : ''}`}
            disabled={auto}
            onClick={() => onRewind(rewindTo)}
            title={auto ? 'データがないためフォールド扱い' : 'ここから選び直す'}
          >
            <span className="path-position">{step.position}</span>
            <span className="path-action" style={{ color: actionColor(step.action) }}>
              {step.action.label}
            </span>
          </button>
        )
      })}

      {walk.status === 'deciding' && <CurrentDecision walk={walk} onChoose={onChoose} />}
    </div>
  )
}

function CurrentDecision({
  walk,
  onChoose,
}: {
  walk: Extract<Walk, { status: 'deciding' }>
  onChoose: Props['onChoose']
}) {
  const overall = overallFrequencies(walk.strategy)
  return (
    <div className="path-card current">
      <span className="path-position">{walk.position}</span>
      {walk.strategy.actions.map((action, index) => (
        <button
          key={action.kind}
          className="choice"
          style={{ borderColor: actionColor(action) }}
          onClick={() => onChoose(action.kind)}
        >
          {action.label}
          <small>{formatPercent(overall[index])}</small>
        </button>
      ))}
    </div>
  )
}
