import type { Walk } from '../poker/preflop'
import type { ActionKind } from '../poker/strategy'
import { actionColor } from './actionColors'
import { DecisionBar } from './DecisionBar'

interface Props {
  walk: Walk
  /** 何番目の意思決定まで巻き戻すか */
  onRewind: (choiceCount: number) => void
  onChoose: (kind: ActionKind) => void
}

export function ActionPath({ walk, onRewind, onChoose }: Props) {
  let choiceCount = 0
  return (
    <div className="action-line">
      {walk.steps.map((step, index) => {
        const rewindTo = choiceCount
        const auto = step.strategy === null
        if (!auto) choiceCount++
        return (
          <button
            key={index}
            className="step"
            disabled={auto}
            onClick={() => onRewind(rewindTo)}
            title={auto ? 'データがないためフォールド扱い' : 'ここから選び直す'}
            style={{ '--action': actionColor(step.action) } as React.CSSProperties}
          >
            <span className="step-actor">{step.position}</span>
            <span className="step-action">{step.action.label}</span>
          </button>
        )
      })}

      {walk.status === 'deciding' && (
        <DecisionBar
          actor={walk.position}
          strategy={walk.strategy}
          onChoose={(index) => onChoose(walk.strategy.actions[index].kind)}
        />
      )}
    </div>
  )
}
