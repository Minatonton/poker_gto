import { POSITIONS, type Position, type PreflopSolution } from '../poker/preflop'
import type { PreflopLine } from '../poker/preflopLine'
import type { ActionKind } from '../poker/strategy'
import { Segmented } from './Segmented'

interface Props {
  solution: PreflopSolution
  line: PreflopLine
  onChange: (line: PreflopLine) => void
}

const positionOptions = (positions: readonly Position[]) => positions.map((p) => ({ value: p, label: p }))

/** 誰がオープンし、誰がどう応じたかを選んでラインを作る。上の段を変えたら下の段は選び直しにする */
export function ScenarioPicker({ solution, line, onChange }: Props) {
  const openers = POSITIONS.filter((p) => solution.rfi[p])
  const responders = line.opener ? POSITIONS.filter((p) => solution.vsOpen[line.opener!]?.[p]) : []
  const responseSpec = line.opener && line.responder ? solution.vsOpen[line.opener]?.[line.responder] : undefined
  const hasReply = line.opener && line.responder ? Boolean(solution.vs3bet[line.opener]?.[line.responder]) : false

  return (
    <section className="card">
      <header className="card-header">
        シチュエーション
        <button type="button" className="btn small-btn aside-btn" onClick={() => onChange({})}>
          リセット
        </button>
      </header>
      <div className="card-body scenario">
        <Segmented
          label="オープン"
          options={positionOptions(openers)}
          value={line.opener}
          onChange={(opener) => onChange({ opener })}
        />
        {line.opener && (
          <Segmented
            label="応じた人"
            options={positionOptions(responders)}
            value={line.responder}
            onChange={(responder) => onChange({ opener: line.opener, responder })}
          />
        )}
        {responseSpec && (
          <Segmented<'call' | 'raise'>
            label="そのアクション"
            options={[
              ...(responseSpec.call ? [{ value: 'call' as const, label: 'Call' }] : []),
              { value: 'raise', label: `3Bet ${responseSpec.raiseTo}bb` },
            ]}
            value={line.response}
            onChange={(response) => onChange({ opener: line.opener, responder: line.responder, response })}
          />
        )}
        {line.response === 'raise' && hasReply && (
          <Segmented<ActionKind>
            label={`${line.opener} の対応`}
            options={[
              { value: 'call', label: 'Call' },
              { value: 'raise', label: '4Bet' },
              { value: 'fold', label: 'Fold' },
            ]}
            value={line.openerReply}
            onChange={(openerReply) => onChange({ ...line, openerReply })}
          />
        )}
      </div>
    </section>
  )
}
