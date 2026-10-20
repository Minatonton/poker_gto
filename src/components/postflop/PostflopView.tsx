import { useEffect, useMemo, useRef, useState } from 'react'
import { cardFromId, displayBoard, isSameHoleCards } from '../../poker/cards'
import { heroHandFor, type Hero } from '../../poker/hero'
import type { PostflopSpot } from '../../poker/postflopSpot'
import { seatsFromBottom } from '../../poker/table'
import { aggregateNode, toActions, toBb } from '../../solver/aggregate'
import { SolverClient, type SolvedStatus } from '../../solver/client'
import type { NodeInfo, PlayerNode, SolveOptions, SolverStatus, SpotConfig } from '../../solver/types'
import { actionColor, formatPercent } from '../actionColors'
import { StudyView } from '../StudyView'
import { ActionBar } from '../table/ActionBar'
import { HandHistory, type HistoryEntry } from '../table/HandHistory'
import { PokerTable, type SeatView } from '../table/PokerTable'
import { BoardCards, CardPicker } from './Cards'
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
  const [showFrequencies, setShowFrequencies] = useState(true)
  // ストリートの最初のノードのベット額を覚えておき、いまのストリートで前に出したチップを求める
  const [visited, setVisited] = useState(() => new Map<string, NodeInfo>())

  useEffect(() => () => clientRef.current?.dispose(), [])

  useEffect(() => {
    if (phase.name !== 'solved' || !clientRef.current) return
    let cancelled = false
    const history = path.map((p) => p.choice)
    clientRef.current
      .node(history)
      .then((next) => {
        if (cancelled) return
        setVisited((current) => new Map(current).set(history.join(), next))
        setNode(next)
      })
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
    setVisited(new Map())
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
        {phase.name === 'solved' && <HandHistory entries={historyEntries(path, setPath)} />}
      </div>

      <div className="postflop-main">
        {error && (
          <section className="card">
            <p className="empty-note error">{error}</p>
          </section>
        )}
        {phase.name === 'solved' && node ? (
          <>
            <PostflopTable
              spot={spot}
              hero={hero}
              node={node}
              path={path}
              streetStart={visited.get(streetStartHistory(path).join())}
              showFrequencies={showFrequencies}
              onToggleFrequencies={() => setShowFrequencies(!showFrequencies)}
              onPath={setPath}
            />
            <NodeBody key={path.length} spot={spot} hero={hero} node={node} />
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

/** いまのストリートが始まったときの履歴（最後に配られたカードまで） */
function streetStartHistory(path: PathEntry[]): number[] {
  const lastCard = path.findLastIndex((entry) => entry.kind === 'card')
  return path.slice(0, lastCard + 1).map((entry) => entry.choice)
}

function historyEntries(path: PathEntry[], onPath: (path: PathEntry[]) => void): HistoryEntry[] {
  let cardsDealt = 0
  return path.map((entry, index) => {
    const onRewind = () => onPath(path.slice(0, index))
    if (entry.kind === 'card') return { actor: STREET_AFTER_CARD[cardsDealt++], label: entry.card, onRewind }
    return { actor: entry.actor, label: entry.label, color: entry.color, onRewind }
  })
}

interface PostflopTableProps {
  spot: PostflopSpot
  hero: Hero
  node: NodeInfo
  path: PathEntry[]
  /** いまのストリートの最初のノード。まだ取得していなければ undefined */
  streetStart: NodeInfo | undefined
  showFrequencies: boolean
  onToggleFrequencies: () => void
  onPath: (path: PathEntry[]) => void
}

function PostflopTable({
  spot,
  hero,
  node,
  path,
  streetStart,
  showFrequencies,
  onToggleFrequencies,
  onPath,
}: PostflopTableProps) {
  const aggregated = useMemo(() => (node.kind === 'player' ? aggregateNode(node) : null), [node])
  const actor = node.kind === 'player' ? (node.player === 0 ? spot.oop : spot.ip) : null
  const startBets = streetStart?.bets ?? [0, 0]
  const streetBets = [node.bets[0] - startBets[0], node.bets[1] - startBets[1]]
  const streetActions = path.slice(path.findLastIndex((e) => e.kind === 'card') + 1)
  const folded = streetActions.find((e) => e.kind === 'action' && e.label === 'Fold')

  const seats: SeatView[] = seatsFromBottom(hero.position ?? spot.ip).map((position) => {
    const side = position === spot.oop ? 0 : position === spot.ip ? 1 : null
    const last = streetActions.findLast((e) => e.kind === 'action' && e.actor === position)
    return {
      position,
      stack: side === null ? null : spot.effectiveStackBb - toBb(node.bets[side]),
      bet: side === null ? 0 : toBb(streetBets[side]),
      folded: side === null || (folded?.kind === 'action' && folded.actor === position),
      acting: position === actor,
      hero: position === hero.position,
      cards: position === hero.position ? hero.cards : null,
      lastAction: last?.kind === 'action' ? { label: last.label, color: last.color } : undefined,
    }
  })

  const choose = (index: number) => {
    if (!aggregated || !actor) return
    const action = aggregated.strategy.actions[index]
    onPath([...path, { kind: 'action', choice: index, actor, label: action.label, color: actionColor(action) }])
  }

  return (
    <section className="card table-card">
      <PokerTable
        seats={seats}
        pot={toBb(node.pot - streetBets[0] - streetBets[1])}
        board={displayBoard(node.board)}
      />
      {aggregated && actor ? (
        <ActionBar
          actor={actor}
          strategy={aggregated.strategy}
          showFrequencies={showFrequencies}
          onToggleFrequencies={onToggleFrequencies}
          heroHand={heroHandFor(hero, actor)}
          onChoose={choose}
        />
      ) : node.kind === 'chance' ? (
        <div className="action-bar">
          <div className="action-bar-head">
            <strong>{node.board.length === 3 ? 'ターン' : 'リバー'}のカードを選んでください</strong>
          </div>
          <CardPicker
            possibleCards={node.possibleCards}
            onPick={(id) => onPath([...path, { kind: 'card', choice: id, card: cardFromId(id) }])}
          />
        </div>
      ) : (
        <div className="action-bar">
          <div className="action-bar-head">
            <strong>{folded ? `${folded.kind === 'action' ? folded.actor : ''} がフォールドしてハンド終了` : 'ショーダウン'}</strong>
          </div>
          <div className="finished-actions">
            <button className="btn" onClick={() => onPath(path.slice(0, -1))}>
              1つ戻る
            </button>
            <button className="btn" onClick={() => onPath([])}>
              フロップに戻る
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function NodeBody({ spot, hero, node }: { spot: PostflopSpot; hero: Hero; node: NodeInfo }) {
  const aggregated = useMemo(() => (node.kind === 'player' ? aggregateNode(node) : null), [node])
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
