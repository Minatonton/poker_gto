import { useEffect, useMemo, useRef, useState } from 'react'
import { cardFromId, displayBoard, isSameHoleCards } from '../../poker/cards'
import { heroHandFor, type Hero } from '../../poker/hero'
import type { PostflopSpot } from '../../poker/postflopSpot'
import { aggregateNode, toActions, toBb } from '../../solver/aggregate'
import { SolverClient, type SolvedStatus } from '../../solver/client'
import type { NodeInfo, PlayerNode, SolveOptions, SolverStatus, SpotConfig } from '../../solver/types'
import { actionColor, formatPercent } from '../actionColors'
import { DecisionBar } from '../DecisionBar'
import { StudyView } from '../StudyView'
import { BoardCards, CardPicker, PlayingCard } from './Cards'
import { EquityGraph, RangeSummaryCard } from './RangeSummary'
import { SolveSettings } from './SolveSettings'

type Phase =
  | { name: 'setup' }
  | {
      name: 'solving'
      startingPot: number
      options: SolveOptions
      status?: Extract<SolverStatus, { state: 'solving' }>
    }
  | { name: 'solved'; startingPot: number; result: SolvedStatus }

type PathEntry =
  | { kind: 'action'; choice: number; actor: string; label: string; color: string }
  | { kind: 'card'; choice: number; card: string }

interface Props {
  spot: PostflopSpot
  hero: Hero
  /** ソルブが終わり、サーバーにこのスポットの解が載ったとき */
  onSolved?: () => void
}

export function PostflopView({ spot, hero, onSolved }: Props) {
  const clientRef = useRef<SolverClient | null>(null)
  const [phase, setPhase] = useState<Phase>({ name: 'setup' })
  const [error, setError] = useState('')
  const [path, setPath] = useState<PathEntry[]>([])
  const [node, setNode] = useState<NodeInfo | null>(null)

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
    setPhase({ name: 'solving', startingPot, options })
    try {
      const result = await clientRef.current.solve(config, options, (status) => {
        if (status.state === 'solving') setPhase((p) => (p.name === 'solving' ? { ...p, status } : p))
      })
      setPhase({ name: 'solved', startingPot, result })
      onSolved?.()
    } catch (e) {
      setError((e as Error).message)
      setPhase({ name: 'setup' })
    }
  }

  return (
    <div className="postflop">
      <div className="postflop-side">
        <SolveSettings spot={spot} heroCards={hero.cards} disabled={phase.name === 'solving'} onSolve={solve} />
        {phase.name === 'solved' && (
          <section className="card">
            <header className="card-header">
              ソルブ完了
              <span className="aside num">
                {phase.result.iteration} 回 / 精度 {formatPercent(phase.result.exploitability / phase.startingPot)}
              </span>
            </header>
          </section>
        )}
      </div>

      <div className="postflop-main">
        {error && (
          <section className="card">
            <p className="empty-note error">{error}</p>
          </section>
        )}
        {phase.name === 'solved' && node ? (
          <>
            <section className="card">
              <div className="node-meta">
                <BoardCards cards={displayBoard(node.board)} />
                <span className="pot">
                  ポット<strong>{toBb(node.pot).toFixed(2)}bb</strong>
                </span>
              </div>
              <PostflopPath spot={spot} node={node} path={path} onPath={setPath} />
            </section>
            <NodeBody
              key={path.length}
              spot={spot}
              hero={hero}
              node={node}
              onPick={(entry) => setPath([...path, entry])}
            />
          </>
        ) : phase.name === 'solving' ? (
          <SolvingStatus phase={phase} onStop={() => clientRef.current?.stop()} />
        ) : (
          phase.name === 'setup' && (
            <section className="card empty-state">
              <p>ボードとベットサイズを決めて「ソルブする」を押すと、ここに各ノードの戦略が表示されます。</p>
            </section>
          )
        )}
      </div>
    </div>
  )
}

function SolvingStatus({ phase, onStop }: { phase: Extract<Phase, { name: 'solving' }>; onStop: () => void }) {
  const { status, startingPot, options } = phase
  const ratio = status ? status.iteration / options.maxIterations : 0
  return (
    <section className="card">
      <header className="card-header">
        {status ? 'ソルブ中' : 'ゲームツリーを構築中'}
        {status && (
          <span className="aside num">
            {(status.memoryBytes / 1024 ** 3).toFixed(2)}GiB{status.compressed ? '（圧縮）' : ''}
          </span>
        )}
      </header>
      <div className="progress">
        <div className="progress-track">
          <span style={{ width: `${ratio * 100}%` }} />
        </div>
        <div className="progress-stats">
          <span className="num">
            {status?.iteration ?? 0} / {options.maxIterations} 回
          </span>
          <span className="num">
            精度 {status?.exploitability != null ? formatPercent(status.exploitability / startingPot) : '—'}
            {' / 目標 '}
            {formatPercent(options.targetExploitability / startingPot)}
          </span>
        </div>
        <button className="btn" onClick={onStop}>
          中断して結果を見る
        </button>
      </div>
    </section>
  )
}

const STREET_AFTER_CARD = ['ターン', 'リバー']

function PostflopPath({
  spot,
  node,
  path,
  onPath,
}: {
  spot: PostflopSpot
  node: NodeInfo
  path: PathEntry[]
  onPath: (path: PathEntry[]) => void
}) {
  const aggregated = useMemo(() => (node.kind === 'player' ? aggregateNode(node) : null), [node])
  const actor = node.kind === 'player' ? (node.player === 0 ? spot.oop : spot.ip) : ''
  let cardsDealt = 0

  return (
    <div className="action-line">
      {path.map((entry, index) => {
        const rewind = () => onPath(path.slice(0, index))
        if (entry.kind === 'card') {
          return (
            <button key={index} className="step card-step" onClick={rewind} title="ここから選び直す">
              <span className="step-actor">{STREET_AFTER_CARD[cardsDealt++]}</span>
              <PlayingCard card={entry.card} />
            </button>
          )
        }
        return (
          <button
            key={index}
            className="step"
            onClick={rewind}
            title="ここから選び直す"
            style={{ '--action': entry.color } as React.CSSProperties}
          >
            <span className="step-actor">{entry.actor}</span>
            <span className="step-action">{entry.label}</span>
          </button>
        )
      })}
      {aggregated && (
        <DecisionBar
          actor={actor}
          strategy={aggregated.strategy}
          onChoose={(index) => {
            const action = aggregated.strategy.actions[index]
            onPath([...path, { kind: 'action', choice: index, actor, label: action.label, color: actionColor(action) }])
          }}
        />
      )}
      {node.kind === 'terminal' && <span className="muted small">このラインはここで終わりです</span>}
    </div>
  )
}

function NodeBody({
  spot,
  hero,
  node,
  onPick,
}: {
  spot: PostflopSpot
  hero: Hero
  node: NodeInfo
  onPick: (entry: PathEntry) => void
}) {
  const aggregated = useMemo(() => (node.kind === 'player' ? aggregateNode(node) : null), [node])

  if (node.kind === 'chance') {
    return (
      <section className="card">
        <header className="card-header">{node.board.length === 3 ? 'ターン' : 'リバー'}のカードを選ぶ</header>
        <CardPicker
          possibleCards={node.possibleCards}
          onPick={(id) => onPick({ kind: 'card', choice: id, card: cardFromId(id) })}
        />
      </section>
    )
  }
  if (node.kind !== 'player' || !aggregated) return null

  const actor = node.player === 0 ? spot.oop : spot.ip
  const heroHand = heroHandFor(hero, actor)
  return (
    <>
      <RangeSummaryCard spot={spot} node={node} />
      <StudyView
        strategy={aggregated.strategy}
        stats={aggregated.stats}
        potBb={toBb(node.pot)}
        heroHand={heroHand}
        aside={heroHand && hero.cards && <HeroComboCard node={node} cards={hero.cards} />}
        below={<EquityGraph spot={spot} node={node} />}
      />
    </>
  )
}

/** ハンドクラスでまとめず、自分の2枚そのものの戦略を出す。スートによって戦略が変わることがあるため */
function HeroComboCard({ node, cards }: { node: PlayerNode; cards: [string, string] }) {
  const actions = toActions(node.actions, node.pot)
  const combo = node.hands.find((h) => isSameHoleCards(h.cards, cards.join('')))
  const onBoard = cards.some((card) => node.board.includes(card))

  let body
  if (onBoard) {
    body = <p className="empty-note">手札がボードと重なっています。手札かボードを見直してください。</p>
  } else if (!combo || combo.weight <= 0) {
    body = <p className="empty-note">このラインでは、このハンドはレンジに含まれていません。</p>
  } else {
    body = (
      <>
        <ul className="action-list">
          <li className="action-row static with-ev head">
            <span />
            <span>アクション</span>
            <span className="num">頻度</span>
            <span className="num">EV</span>
          </li>
          {actions.map((action, index) => (
            <li key={action.label} className="action-row static with-ev">
              <span className="swatch" style={{ background: actionColor(action) }} />
              <span>{action.label}</span>
              <span className="num">{formatPercent(combo.strategy[index])}</span>
              <span className="num muted">{toBb(combo.actionEvs[index] ?? 0).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <dl className="hand-stats">
          <div>
            <dt>EV</dt>
            <dd className="num">{toBb(combo.ev ?? 0).toFixed(2)}bb</dd>
          </div>
          <div>
            <dt>エクイティ</dt>
            <dd className="num">{formatPercent(combo.equity ?? 0)}</dd>
          </div>
        </dl>
      </>
    )
  }

  return (
    <section className="card hero-card">
      <header className="card-header">
        自分の手札
        <span className="aside">
          <BoardCards cards={cards} />
        </span>
      </header>
      {body}
    </section>
  )
}
