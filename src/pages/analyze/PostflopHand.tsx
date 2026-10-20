import { useMemo, useState } from 'react'
import { actionColor, formatPercent } from '../../components/actionColors'
import { RangeBreakdown } from '../../components/postflop/RangeBreakdown'
import { EquityGraph, RangeSummaryCard } from '../../components/postflop/RangeSummary'
import { StudyView } from '../../components/StudyView'
import { ActionBar } from '../../components/table/ActionBar'
import { AdvicePanel, type HandAdvice } from '../../components/table/AdvicePanel'
import { CardSelect } from '../../components/table/CardSelect'
import { HandHistory, type HistoryEntry } from '../../components/table/HandHistory'
import { PokerTable, type SeatView } from '../../components/table/PokerTable'
import { cardFromId, displayBoard, isSameHoleCards, randomFlop } from '../../poker/cards'
import { heroHandFor, type Hero, type HeroInput } from '../../poker/hero'
import type { PostflopSpot } from '../../poker/postflopSpot'
import type { Walk } from '../../poker/preflop'
import { overallFrequencies, type ActionKind } from '../../poker/strategy'
import { dealerOf, seatsFromBottom } from '../../poker/table'
import { aggregateNode, toBb } from '../../solver/aggregate'
import { spotConfig, type Street, type StreetSizeOptions } from '../../solver/spotConfig'
import type { NodeInfo, PlayerNode } from '../../solver/types'
import { usePostflopSolve, type PathEntry } from '../../solver/usePostflopSolve'
import { coachForSeat, preflopHistory } from './handHelpers'
import { GameScreen, type DockTab } from '../../components/game/GameScreen'

/**
 * ベットサイズを1つ増やすごとに後続のツリーが掛け算で増える。
 * 全ストリート2サイズにすると SRP でも10GiB を超え、ソルブに数十分かかるため、ターン以降は1サイズにしている。
 */
const DEFAULT_SIZES: StreetSizeOptions = {
  flop: { bet: '33%, 75%', raise: '3x' },
  turn: { bet: '75%', raise: '3x' },
  river: { bet: '75%', raise: '3x' },
}
const STREET_LABELS: Record<Street, string> = { flop: 'フロップ', turn: 'ターン', river: 'リバー' }

type Picking = 'hero' | 'flop' | 'next' | null

export interface PostflopHandProps {
  spot: PostflopSpot
  walk: Walk
  choices: ActionKind[]
  onNavigate: (choices: ActionKind[]) => void
  heroInput: HeroInput
  hero: Hero
  onHeroInput: (input: HeroInput) => void
  onRecord: () => void
  onSolved: () => void
}

export function PostflopHand(props: PostflopHandProps) {
  const { spot, walk, choices, onNavigate, heroInput, hero, onHeroInput, onRecord, onSolved } = props
  const solve = usePostflopSolve(onSolved)
  const [flop, setFlop] = useState<string[]>([])
  const [picking, setPicking] = useState<Picking>(null)
  const [hidden, setHidden] = useState(false)
  const [sizes, setSizes] = useState(DEFAULT_SIZES)
  const [maxIterations, setMaxIterations] = useState(1000)
  const [targetPercent, setTargetPercent] = useState(0.5)

  const node = solve.phase.name === 'solved' ? solve.node : null
  const aggregated = useMemo(() => (node?.kind === 'player' ? aggregateNode(node) : null), [node])
  const actor = node?.kind === 'player' ? (node.player === 0 ? spot.oop : spot.ip) : null
  const heroCards: string[] = hero.cards ?? []
  const board = node ? displayBoard(node.board) : displayBoard(flop)

  const startSolve = () => {
    const config = spotConfig(spot, flop.join(''), sizes)
    solve.solve(config, { maxIterations, targetExploitability: (config.startingPot * targetPercent) / 100 })
  }

  const backToFlop = () => {
    solve.reset()
    setPicking(null)
  }

  const history: HistoryEntry[] = [
    ...preflopHistory(walk, choices, onNavigate),
    ...(flop.length === 3 ? [{ actor: 'フロップ', label: displayBoard(flop).join(' '), onRewind: backToFlop }] : []),
    ...pathHistory(solve.path, solve.setPath),
  ]

  const handAdvice = node?.kind === 'player' && actor ? adviceForHero(node, actor, hero) : undefined

  const advice = node?.kind === 'player' && aggregated && actor && (
    <>
      <AdvicePanel
        actor={actor}
        actions={aggregated.strategy.actions}
        rangeFrequencies={overallFrequencies(aggregated.strategy)}
        hand={handAdvice?.advice}
        note={handAdvice?.note}
        hidden={hidden}
        onToggleHidden={() => setHidden(!hidden)}
      />
      {!hidden && (
        <StudyView
          key={solve.path.length}
          strategy={aggregated.strategy}
          stats={aggregated.stats}
          potBb={toBb(node.pot)}
          heroHand={heroHandFor(hero, actor)}
        />
      )}
    </>
  )
  const tabs: DockTab[] = [
    ...(advice ? [{ id: 'answer', label: 'GTO の答え', content: advice }] : []),
    ...(node?.kind === 'player'
      ? [
          {
            id: 'range',
            label: 'レンジ分析',
            content: (
              <>
                <RangeSummaryCard spot={spot} node={node} />
                <RangeBreakdown node={node} />
                <EquityGraph spot={spot} node={node} />
              </>
            ),
          },
        ]
      : []),
    {
      id: 'history',
      label: '履歴',
      content: (
        <>
          {solve.phase.name === 'solved' && (
            <p className="muted small solve-result">
              計算結果: {solve.phase.result.iteration} 回反復・精度 ポットの{' '}
              {formatPercent(solve.phase.result.exploitability / solve.phase.startingPot)}
            </p>
          )}
          <HandHistory
            entries={history}
            footer={
              <div className="finished-actions">
                <button className="btn small-btn" onClick={onRecord}>
                  このハンドを記録する
                </button>
                <button className="btn small-btn" onClick={() => onNavigate([])}>
                  最初からやり直す
                </button>
              </div>
            }
          />
        </>
      ),
    },
    ...(solve.phase.name === 'idle'
      ? [
          {
            id: 'settings',
            label: '計算の設定',
            content: (
              <section className="card solve-options">
                <header className="card-header">計算の設定（ベットサイズ・精度）</header>
                <div className="card-body">
                  <div className="size-grid">
                    <span />
                    <span className="head">ベット（ポット比 % / オールイン a）</span>
                    <span className="head">レイズ（倍率 x）</span>
                    {(Object.keys(STREET_LABELS) as Street[]).map((street) => (
                      <SizeRow
                        key={street}
                        label={STREET_LABELS[street]}
                        value={sizes[street]}
                        onChange={(value) => setSizes({ ...sizes, [street]: value })}
                      />
                    ))}
                  </div>
                  <div className="field-pair">
                    <label className="field">
                      <span>最大反復回数</span>
                      <input
                        type="number"
                        min={10}
                        value={maxIterations}
                        onChange={(e) => setMaxIterations(Number(e.target.value))}
                      />
                    </label>
                    <label className="field">
                      <span>目標精度（ポット比 %）</span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={targetPercent}
                        onChange={(e) => setTargetPercent(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <p className="muted small">サイズを増やすと計算は正確になりますが、時間とメモリが大きく増えます。</p>
                </div>
              </section>
            ),
          },
        ]
      : []),
  ]

  return (
    <GameScreen
      coach={<Coach phase={solve.phase.name} node={node} actor={actor} hero={hero} flopReady={flop.length === 3} />}
      table={
        <PokerTable
          seats={postflopSeats(spot, node, solve.streetStart, solve.path, hero)}
          pot={tablePot(spot, node, solve.streetStart)}
          board={board}
          boardSlots={node ? (node.kind === 'chance' ? node.board.length + 1 : node.board.length) : 3}
          onBoardClick={
            solve.phase.name === 'idle'
              ? () => setPicking('flop')
              : node?.kind === 'chance'
                ? () => setPicking('next')
                : undefined
          }
          onSeatClick={(position) =>
            onHeroInput({ ...heroInput, position: heroInput.position === position ? null : position })
          }
          onHeroCardsClick={() => setPicking('hero')}
          center={solve.phase.name === 'solving' && <SolvingBadge phase={solve.phase} />}
          overlay={
            picking && (
              <PickerFor
                picking={picking}
                node={node}
                flop={flop}
                heroCards={heroCards}
                onHero={(cards) => onHeroInput({ ...heroInput, cardsText: cards.join('') })}
                onFlop={setFlop}
                onNext={(card) =>
                  solve.setPath([...solve.path, { kind: 'card', choice: card, card: cardFromId(card) }])
                }
                onClose={() => setPicking(null)}
              />
            )
          }
        />
      }
      controls={
        solve.phase.name === 'idle' ? (
          <div className="solve-controls">
            <div className="finished-actions">
              <button className="btn primary large" disabled={flop.length !== 3} onClick={startSolve}>
                このフロップを計算する
              </button>
              <button className="btn" onClick={() => setFlop(randomFlop(heroCards))}>
                ランダムなフロップ
              </button>
            </div>
            {solve.error && <p className="error small">{solve.error}</p>}
          </div>
        ) : solve.phase.name === 'solving' ? (
          <SolvingControls phase={solve.phase} onStop={solve.stop} />
        ) : node?.kind === 'player' && aggregated && actor ? (
          <ActionBar
            actions={aggregated.strategy.actions}
            disabled={picking !== null}
            onChoose={(index) => {
              const action = aggregated.strategy.actions[index]
              solve.setPath([
                ...solve.path,
                { kind: 'action', choice: index, actor, label: action.label, color: actionColor(action) },
              ])
            }}
          />
        ) : node?.kind === 'chance' ? (
          <div className="finished-actions">
            <button className="btn primary large" onClick={() => setPicking('next')}>
              {node.board.length === 3 ? 'ターン' : 'リバー'}のカードを選ぶ
            </button>
            <button
              className="btn"
              onClick={() => {
                const candidates = node.possibleCards.filter((id) => !heroCards.includes(cardFromId(id)))
                const card = candidates[Math.floor(Math.random() * candidates.length)]
                solve.setPath([...solve.path, { kind: 'card', choice: card, card: cardFromId(card) }])
              }}
            >
              ランダムに配る
            </button>
          </div>
        ) : (
          <div className="finished-actions">
            <button className="btn" onClick={() => solve.setPath(solve.path.slice(0, -1))}>
              1つ戻る
            </button>
            <button className="btn" onClick={() => solve.setPath([])}>
              フロップの最初に戻る
            </button>
          </div>
        )
      }
      tabs={tabs}
    />
  )
}

function Coach({
  phase,
  node,
  actor,
  hero,
  flopReady,
}: {
  phase: 'idle' | 'solving' | 'solved'
  node: NodeInfo | null
  actor: string | null
  hero: Hero
  flopReady: boolean
}) {
  if (phase === 'idle') {
    return flopReady ? (
      <>
        <strong>「このフロップを計算する」を押してください。</strong>1〜数分で GTO を計算します。
      </>
    ) : (
      <>
        <strong>フロップのカードを選んでください。</strong>卓の中央の ＋ をクリックするか、ランダムに配れます。
      </>
    )
  }
  if (phase === 'solving') {
    return (
      <>
        <strong>計算中です。</strong>精度が目標に届くと自動で終わります。途中の結果で先に進むこともできます。
      </>
    )
  }
  if (!node) return <strong>読み込み中…</strong>
  if (node.kind === 'chance') {
    return <strong>{node.board.length === 3 ? 'ターン' : 'リバー'}のカードを選んでください。</strong>
  }
  if (node.kind === 'terminal')
    return <strong>このラインはここで終わりです。履歴の行を押すと、そこからやり直せます。</strong>
  const seatHint = coachForSeat(hero)
  return (
    <>
      {actor === hero.position ? (
        <>
          <strong>あなたの番です。</strong>右の「GTO の答え」と比べながら、実際に選んだアクションを入れてください。
        </>
      ) : (
        <>
          <strong>{actor} の番です。</strong>実際に起きたアクションを下のボタンで選んでください。
        </>
      )}
      {seatHint && <span className="coach-hint">{seatHint}</span>}
    </>
  )
}

function SolvingBadge({
  phase,
}: {
  phase: Extract<ReturnType<typeof usePostflopSolve>['phase'], { name: 'solving' }>
}) {
  const ratio = phase.status ? phase.status.iteration / phase.options.maxIterations : 0
  return (
    <span className="solving-badge">
      <span className="solving-ring" style={{ '--progress': `${ratio * 360}deg` } as React.CSSProperties} />
      計算中
    </span>
  )
}

function SolvingControls({
  phase,
  onStop,
}: {
  phase: Extract<ReturnType<typeof usePostflopSolve>['phase'], { name: 'solving' }>
  onStop: () => void
}) {
  const { status, startingPot, options } = phase
  const ratio = status ? status.iteration / options.maxIterations : 0
  return (
    <div className="progress">
      <div className="progress-track">
        <span style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="progress-stats">
        <span className="num">
          {status ? `${status.iteration} / ${options.maxIterations} 回` : 'ゲームツリーを作っています'}
          {status && `・メモリ ${(status.memoryBytes / 1024 ** 3).toFixed(1)}GiB`}
        </span>
        <span className="num">
          精度 {status?.exploitability != null ? formatPercent(status.exploitability / startingPot) : '—'}（目標{' '}
          {formatPercent(options.targetExploitability / startingPot)}）
        </span>
      </div>
      <div>
        <button className="btn" onClick={onStop}>
          ここまでの結果で先に進む
        </button>
      </div>
    </div>
  )
}

function PickerFor({
  picking,
  node,
  flop,
  heroCards,
  onHero,
  onFlop,
  onNext,
  onClose,
}: {
  picking: Exclude<Picking, null>
  node: NodeInfo | null
  flop: string[]
  heroCards: string[]
  onHero: (cards: string[]) => void
  onFlop: (cards: string[]) => void
  onNext: (card: number) => void
  onClose: () => void
}) {
  const board = node?.board ?? flop
  if (picking === 'hero') {
    return (
      <CardSelect
        title="あなたの手札を2枚選んでください"
        count={2}
        initial={heroCards}
        unavailable={board}
        onDone={(cards) => {
          onHero(cards)
          onClose()
        }}
        onCancel={onClose}
      />
    )
  }
  if (picking === 'flop') {
    return (
      <CardSelect
        title="フロップの3枚を選んでください"
        count={3}
        initial={flop}
        unavailable={heroCards}
        onRandom={() => {
          onFlop(randomFlop(heroCards))
          onClose()
        }}
        onDone={(cards) => {
          onFlop(cards)
          onClose()
        }}
        onCancel={onClose}
      />
    )
  }
  const possible = node?.kind === 'chance' ? node.possibleCards.map(cardFromId) : []
  const allCards = Array.from({ length: 52 }, (_, id) => cardFromId(id))
  return (
    <CardSelect
      title={`${board.length === 3 ? 'ターン' : 'リバー'}のカードを選んでください`}
      count={1}
      unavailable={[...allCards.filter((card) => !possible.includes(card)), ...heroCards]}
      onDone={([card]) => {
        onNext(allCards.indexOf(card))
        onClose()
      }}
      onCancel={onClose}
    />
  )
}

function SizeRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: { bet: string; raise: string }
  onChange: (value: { bet: string; raise: string }) => void
}) {
  return (
    <>
      <span>{label}</span>
      <input
        aria-label={`${label}のベット`}
        value={value.bet}
        onChange={(e) => onChange({ ...value, bet: e.target.value })}
      />
      <input
        aria-label={`${label}のレイズ`}
        value={value.raise}
        onChange={(e) => onChange({ ...value, raise: e.target.value })}
      />
    </>
  )
}

const STREET_AFTER_CARD = ['ターン', 'リバー']

function pathHistory(path: PathEntry[], onPath: (path: PathEntry[]) => void): HistoryEntry[] {
  let cardsDealt = 0
  return path.map((entry, index) => {
    const onRewind = () => onPath(path.slice(0, index))
    if (entry.kind === 'card') return { actor: STREET_AFTER_CARD[cardsDealt++], label: entry.card, onRewind }
    return { actor: entry.actor, label: entry.label, color: entry.color, onRewind }
  })
}

/** いまのストリートで、各プレイヤーが前に出しているチップ（チップ単位） */
function streetBets(node: NodeInfo | null, streetStart: NodeInfo | undefined): [number, number] {
  if (!node) return [0, 0]
  const start = streetStart?.bets ?? [0, 0]
  return [node.bets[0] - start[0], node.bets[1] - start[1]]
}

/** 卓の中央のポット。いまのストリートで前に出ているチップは含めない */
function tablePot(spot: PostflopSpot, node: NodeInfo | null, streetStart: NodeInfo | undefined): number {
  if (!node) return spot.potBb
  const [oop, ip] = streetBets(node, streetStart)
  return toBb(node.pot - oop - ip)
}

function postflopSeats(
  spot: PostflopSpot,
  node: NodeInfo | null,
  streetStart: NodeInfo | undefined,
  path: PathEntry[],
  hero: Hero,
): SeatView[] {
  const bets = streetBets(node, streetStart)
  const streetActions = path.slice(path.findLastIndex((e) => e.kind === 'card') + 1)
  const folded = streetActions.find((e) => e.kind === 'action' && e.label === 'Fold')
  const acting = node?.kind === 'player' ? (node.player === 0 ? spot.oop : spot.ip) : null
  const dealer = dealerOf(spot.positions)
  return seatsFromBottom(spot.positions, hero.position ?? spot.ip).map((position) => {
    const side = position === spot.oop ? 0 : position === spot.ip ? 1 : null
    const last = streetActions.findLast((e) => e.kind === 'action' && e.actor === position)
    return {
      position,
      dealer: position === dealer,
      stack: side === null ? null : spot.effectiveStackBb - (node ? toBb(node.bets[side]) : 0),
      bet: side === null ? 0 : toBb(bets[side]),
      folded: side === null || (folded?.kind === 'action' && folded.actor === position),
      acting: position === acting,
      hero: position === hero.position,
      cards: position === hero.position ? hero.cards : null,
      lastAction: last?.kind === 'action' ? { label: last.label, color: last.color } : undefined,
    }
  })
}

/** 手番が自分なら、ハンドクラスでまとめず自分の2枚そのものの答えを出す。スートで戦略が変わることがあるため */
function adviceForHero(node: PlayerNode, actor: string, hero: Hero): { advice?: HandAdvice; note?: string } {
  if (hero.position !== actor || !hero.cards) return {}
  const cards = hero.cards
  if (cards.some((card) => node.board.includes(card)))
    return { note: '手札がボードと重なっています。手札を選び直してください。' }
  const combo = node.hands.find((h) => isSameHoleCards(h.cards, cards.join('')))
  if (!combo || combo.weight <= 0)
    return { note: 'このラインでは、あなたの手札は GTO のレンジに含まれていません。レンジ全体の答えを出しています。' }
  return {
    advice: {
      label: cards.join(''),
      frequencies: combo.strategy,
      evs: combo.actionEvs.map((ev) => toBb(ev ?? 0)),
      equity: combo.equity ?? undefined,
    },
  }
}
