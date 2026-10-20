import { useEffect, useMemo, useRef, useState } from 'react'
import { cardFromId, displayBoard } from '../../poker/cards'
import type { HandClass } from '../../poker/hands'
import type { PostflopSpot } from '../../poker/postflopSpot'
import { overallFrequencies } from '../../poker/strategy'
import { aggregateNode, toBb } from '../../solver/aggregate'
import { SolverClient, type SolvedStatus } from '../../solver/client'
import type { NodeInfo, SolveOptions, SolverStatus, SpotConfig } from '../../solver/types'
import { actionColor, formatPercent } from '../actionColors'
import { RangeGrid } from '../RangeGrid'
import { StrategyPanel } from '../StrategyPanel'
import { BoardCards, CardPicker } from './Cards'
import { SolveSettings } from './SolveSettings'

type Phase =
  | { name: 'setup' }
  | { name: 'solving'; startingPot: number; status?: Extract<SolverStatus, { state: 'solving' }> }
  | { name: 'solved'; startingPot: number; result: SolvedStatus }

interface PathEntry {
  choice: number
  label: string
}

export function PostflopView({ spot }: { spot: PostflopSpot }) {
  const clientRef = useRef<SolverClient | null>(null)
  const [phase, setPhase] = useState<Phase>({ name: 'setup' })
  const [error, setError] = useState('')
  const [path, setPath] = useState<PathEntry[]>([])
  const [node, setNode] = useState<NodeInfo | null>(null)
  const [hoveredHand, setHoveredHand] = useState<HandClass | null>(null)
  const [focusedAction, setFocusedAction] = useState<number | null>(null)

  useEffect(() => () => clientRef.current?.dispose(), [])

  useEffect(() => {
    if (phase.name !== 'solved' || !clientRef.current) return
    let cancelled = false
    clientRef.current
      .node(path.map((p) => p.choice))
      .then((next) => !cancelled && setNode(next))
      .catch((e: Error) => setError(e.message))
    return () => {
      cancelled = true
    }
  }, [phase.name, path])

  const solve = async (config: SpotConfig, options: SolveOptions) => {
    clientRef.current ??= new SolverClient()
    setError('')
    setPath([])
    setNode(null)
    const startingPot = config.startingPot
    setPhase({ name: 'solving', startingPot })
    try {
      const result = await clientRef.current.solve(config, options, (status) => {
        if (status.state === 'solving') setPhase((p) => (p.name === 'solving' ? { ...p, status } : p))
      })
      setPhase({ name: 'solved', startingPot, result })
    } catch (e) {
      setError((e as Error).message)
      setPhase({ name: 'setup' })
    }
  }

  const choose = (entry: PathEntry) => {
    setPath([...path, entry])
    setFocusedAction(null)
  }

  return (
    <div className="postflop">
      <SolveSettings spot={spot} disabled={phase.name === 'solving'} onSolve={solve} />
      {error && <p className="error">{error}</p>}
      {phase.name === 'solving' && <SolvingStatus phase={phase} onStop={() => clientRef.current?.stop()} />}
      {phase.name === 'solved' && (
        <>
          <p className="hint">
            {phase.result.iteration} 回反復 / exploitability{' '}
            {formatPercent(phase.result.exploitability / phase.startingPot)}（ポット比）
          </p>
          <PostflopPath spot={spot} path={path} onRewind={(n) => setPath(path.slice(0, n))} />
          {node && (
            <NodeView
              spot={spot}
              node={node}
              onChoose={choose}
              hoveredHand={hoveredHand}
              setHoveredHand={setHoveredHand}
              focusedAction={focusedAction}
              setFocusedAction={setFocusedAction}
            />
          )}
        </>
      )}
    </div>
  )
}

function SolvingStatus({ phase, onStop }: { phase: Extract<Phase, { name: 'solving' }>; onStop: () => void }) {
  const { status, startingPot } = phase
  return (
    <section className="panel solving">
      <p>
        {status
          ? `メモリ ${(status.memoryBytes / 1024 ** 3).toFixed(2)}GiB${status.compressed ? '（圧縮）' : ''} を確保してソルブ中…`
          : 'ゲームツリーを構築中…'}
      </p>
      {status && status.exploitability !== null && (
        <p>
          {status.iteration} 回反復 / exploitability {formatPercent(status.exploitability / startingPot)}（ポット比）
        </p>
      )}
      <button onClick={onStop}>中断して結果を見る</button>
    </section>
  )
}

function PostflopPath({ spot, path, onRewind }: { spot: PostflopSpot; path: PathEntry[]; onRewind: (n: number) => void }) {
  return (
    <div className="action-path">
      <button className="path-card" onClick={() => onRewind(0)} title="ここから選び直す">
        <span className="path-position">
          {spot.oop} vs {spot.ip}
        </span>
        <span className="path-action">フロップ</span>
      </button>
      {path.map((entry, index) => (
        <button key={index} className="path-card" onClick={() => onRewind(index)} title="ここから選び直す">
          <span className="path-action">{entry.label}</span>
        </button>
      ))}
    </div>
  )
}

interface NodeViewProps {
  spot: PostflopSpot
  node: NodeInfo
  onChoose: (entry: PathEntry) => void
  hoveredHand: HandClass | null
  setHoveredHand: (hand: HandClass | null) => void
  focusedAction: number | null
  setFocusedAction: (index: number | null) => void
}

function NodeView({ spot, node, onChoose, hoveredHand, setHoveredHand, focusedAction, setFocusedAction }: NodeViewProps) {
  const aggregated = useMemo(() => (node.kind === 'player' ? aggregateNode(node) : null), [node])

  const header = (
    <p className="node-header">
      <BoardCards cards={displayBoard(node.board)} /> ポット {toBb(node.pot).toFixed(2)}bb
    </p>
  )

  if (node.kind === 'terminal') {
    return (
      <section className="panel">
        {header}
        <p>このラインはここで終わりです。上の履歴から選び直してください。</p>
      </section>
    )
  }

  if (node.kind === 'chance') {
    return (
      <section className="panel">
        {header}
        <p>{node.board.length === 3 ? 'ターン' : 'リバー'}のカードを選んでください</p>
        <CardPicker
          possibleCards={node.possibleCards}
          onPick={(id) => onChoose({ choice: id, label: cardFromId(id) })}
        />
      </section>
    )
  }

  const { strategy, stats } = aggregated!
  const position = node.player === 0 ? spot.oop : spot.ip
  const overall = overallFrequencies(strategy)
  return (
    <>
      {header}
      <div className="action-path">
        <div className="path-card current">
          <span className="path-position">{position}</span>
          {strategy.actions.map((action, index) => (
            <button
              key={action.label}
              className="choice"
              style={{ borderColor: actionColor(action) }}
              onClick={() => onChoose({ choice: index, label: `${position}: ${action.label}` })}
            >
              {action.label}
              <small>{formatPercent(overall[index])}</small>
            </button>
          ))}
        </div>
      </div>
      <main className="study">
        <RangeGrid strategy={strategy} focusedAction={focusedAction} onHover={setHoveredHand} />
        <StrategyPanel
          strategy={strategy}
          stats={stats}
          hoveredHand={hoveredHand}
          focusedAction={focusedAction}
          onFocusAction={setFocusedAction}
        />
      </main>
    </>
  )
}
