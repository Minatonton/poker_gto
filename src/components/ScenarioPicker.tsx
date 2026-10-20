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
  const raiser = line.response === 'raise' ? line.responder : line.overcallAction === 'raise' ? line.overcaller : undefined
  const hasReply = line.opener && raiser ? Boolean(solution.vs3bet[line.opener]?.[raiser]) : false
  const overcallers =
    line.response === 'call' && line.responder
      ? POSITIONS.slice(POSITIONS.indexOf(line.responder) + 1).filter((p) => solution.vsOpenCall?.[p])
      : []
  const overcallSpec = line.overcaller ? solution.vsOpenCall?.[line.overcaller] : undefined
  const base = { opener: line.opener, responder: line.responder, response: line.response }
  const replyOptions: { value: ActionKind; label: string }[] = [
    { value: 'call', label: 'Call' },
    { value: 'raise', label: '4Bet' },
    { value: 'fold', label: 'Fold' },
  ]

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
        {overcallers.length > 0 && (
          <Segmented<Position | 'none'>
            label="さらに応じた人"
            options={[{ value: 'none', label: 'なし' }, ...positionOptions(overcallers)]}
            value={line.overcaller ?? 'none'}
            onChange={(overcaller) => onChange(overcaller === 'none' ? base : { ...base, overcaller })}
          />
        )}
        {overcallSpec && (
          <Segmented<'call' | 'raise'>
            label="そのアクション"
            options={[
              ...(overcallSpec.call ? [{ value: 'call' as const, label: 'Call' }] : []),
              { value: 'raise', label: `Squeeze ${overcallSpec.raiseTo}bb` },
            ]}
            value={line.overcallAction}
            onChange={(overcallAction) => onChange({ ...base, overcaller: line.overcaller, overcallAction })}
          />
        )}
        {raiser && hasReply && (
          <Segmented<ActionKind>
            label={`${line.opener} の対応`}
            options={replyOptions}
            value={line.openerReply}
            onChange={(openerReply) => onChange({ ...line, openerReply })}
          />
        )}
        {line.overcallAction === 'raise' && line.openerReply && line.openerReply !== 'raise' && solution.callerVsSqueeze && (
          <Segmented<ActionKind>
            label={`${line.responder} の対応`}
            options={replyOptions}
            value={line.callerReply}
            onChange={(callerReply) => onChange({ ...line, callerReply })}
          />
        )}
      </div>
    </section>
  )
}
