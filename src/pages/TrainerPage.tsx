import { useCallback, useEffect, useRef, useState } from 'react'
import { actionColor, formatPercent } from '../components/actionColors'
import { BoardCards, PlayingCard } from '../components/postflop/Cards'
import { PokerTable, type SeatView } from '../components/table/PokerTable'
import { preflopSeats } from '../components/table/preflopSeats'
import { Segmented } from '../components/Segmented'
import { StudyView } from '../components/StudyView'
import { cardFromId, cardToId, displayBoard, isSameHoleCards } from '../poker/cards'
import { rangeOfPosition, type Position, type PreflopSolution } from '../poker/preflop'
import type { PostflopSpot } from '../poker/postflopSpot'
import type { Action } from '../poker/strategy'
import { toActions, toBb } from '../solver/aggregate'
import { SolverClient } from '../solver/client'
import type { NodeInfo } from '../solver/types'
import { GRADES, actionForRng, gradeByEv, gradeByFrequency, type Grade } from '../trainer/grading'
import {
  accuracy,
  DAILY_GOAL,
  emptyProgress,
  normalizeProgress,
  recordAnswer,
  todayCount,
  type Progress,
} from '../trainer/progress'
import { ActionBar } from '../components/table/ActionBar'
import { dealNextCard, dealPostflopHands, villainAction } from '../trainer/postflopHand'
import { createPreflopQuestion, PREFLOP_DRILLS, type PreflopDrillKind, type PreflopQuestion } from '../trainer/preflopDrill'
import { explainPostflop, explainPreflop } from '../trainer/explain'
import { equityVsRange } from '../poker/equity'
import { dealerOf, seatOf, seatsFromBottom, tableState } from '../poker/table'
import { classifyHand } from '../poker/handCategory'
import { breakdownNode } from '../solver/breakdown'

type Mode = 'preflop' | 'postflop'

const STATS_KEY = 'poker-gto:trainer-stats'

/** 成績は端末のブラウザにだけ残す。消えても困らない練習の記録なので、読み書きに失敗しても無視する */
function loadStats(): Record<Mode, Progress> {
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY) ?? 'null')
    if (saved?.preflop && saved?.postflop) {
      return { preflop: normalizeProgress(saved.preflop), postflop: normalizeProgress(saved.postflop) }
    }
  } catch {
    // 保存できない環境では、その場限りの成績にする
  }
  return { preflop: emptyProgress(), postflop: emptyProgress() }
}

function saveStats(stats: Record<Mode, Progress>) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    // 同上
  }
}

interface Props {
  solution: PreflopSolution
  /** ポストフロップで直近にソルブしたスポット */
  solvedSpot: PostflopSpot | null
  onOpenAnalyze: () => void
}

export function TrainerPage({ solution, solvedSpot, onOpenAnalyze }: Props) {
  const [mode, setMode] = useState<Mode>('preflop')
  const [useRng, setUseRng] = useState(false)
  const [stats, setStats] = useState(loadStats)

  const record = (grade: Grade) =>
    setStats((current) => {
      const next = { ...current, [mode]: recordAnswer(current[mode], grade) }
      saveStats(next)
      return next
    })

  return (
    <>
      <section className="card">
        <div className="card-body scenario inline">
          <Segmented<Mode>
            label="出題"
            options={[
              { value: 'preflop', label: 'プリフロップ' },
              { value: 'postflop', label: 'ポストフロップ' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <label className="checkbox-row">
            <input type="checkbox" checked={useRng} onChange={(e) => setUseRng(e.target.checked)} />
            RNG を使う
            <span className="muted small">出目に当たるアクションだけを Best にして、混合戦略を頻度どおりに選ぶ練習</span>
          </label>
        </div>
      </section>

      <div className="trainer-layout">
        <div className="trainer-main">
          {mode === 'preflop' ? (
            <PreflopTrainer solution={solution} useRng={useRng} onGrade={record} />
          ) : solvedSpot ? (
            <PostflopTrainer spot={solvedSpot} useRng={useRng} onGrade={record} />
          ) : (
            <section className="card empty-state">
              <p>ポストフロップの出題には、先に「分析」でフロップまで進み、そのスポットをソルブしてください。</p>
              <button className="btn primary" onClick={onOpenAnalyze}>
                分析を開く
              </button>
            </section>
          )}
        </div>
        <ProgressCard
          progress={stats[mode]}
          onReset={() => {
            const next = { ...stats, [mode]: emptyProgress() }
            saveStats(next)
            setStats(next)
          }}
        />
      </div>
    </>
  )
}

const rollRng = () => Math.random()

function PreflopTrainer({
  solution,
  useRng,
  onGrade,
}: {
  solution: PreflopSolution
  useRng: boolean
  onGrade: (grade: Grade) => void
}) {
  const [kind, setKind] = useState<PreflopDrillKind>('rfi')
  const [seat, setSeat] = useState<Position | 'random'>('random')
  const [question, setQuestion] = useState<PreflopQuestion | null>(null)
  const [rng, setRng] = useState(rollRng)
  const [answer, setAnswer] = useState<{ chosen: number; grade: Grade; explanation: string[] } | null>(null)
  const [error, setError] = useState('')
  const [showRange, setShowRange] = useState(false)

  const next = useCallback(
    (nextKind = kind, nextSeat = seat) => {
      const created = createPreflopQuestion(solution, nextKind, nextSeat === 'random' ? null : nextSeat)
      setError(created ? '' : 'この席には、この種類の手番が来ません。席か出題の種類を変えてください。')
      setQuestion(created)
      setAnswer(null)
      setShowRange(false)
      setRng(rollRng())
    },
    [kind, seat, solution],
  )

  useEffect(() => {
    next()
    // 初回の出題だけを作る。以降は「次の問題」や条件の変更で作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const frequencies = question ? (question.walk.strategy.frequencies.get(question.hand) ?? []) : []
  const choose = (index: number) => {
    if (!question || answer) return
    const grade = gradeByFrequency(frequencies, index, useRng ? rng : undefined)
    setAnswer({ chosen: index, grade, explanation: preflopExplanation(question, frequencies, index) })
    onGrade(grade)
  }

  return (
    <>
      <section className="card">
        <div className="card-body scenario">
          <Segmented<PreflopDrillKind>
            label="種類"
            options={PREFLOP_DRILLS.map((d) => ({ value: d.kind, label: d.label }))}
            value={kind}
            onChange={(value) => {
              setKind(value)
              next(value, seat)
            }}
          />
          <Segmented<Position | 'random'>
            label="自分の席"
            options={[{ value: 'random', label: 'ランダム' }, ...solution.positions.map((p) => ({ value: p, label: p }))]}
            value={seat}
            onChange={(value) => {
              setSeat(value)
              next(kind, value)
            }}
          />
        </div>
      </section>

      {error && (
        <section className="card">
          <p className="empty-note">{error}</p>
        </section>
      )}

      {question && (
        <section className="card table-card">
          <PreflopQuestionTable question={question} />
          <Question
            actor={question.walk.position}
            actions={question.walk.strategy.actions}
            rng={useRng ? rng : undefined}
            answered={answer !== null}
            onChoose={choose}
          />
          {answer && (
            <Feedback
              grade={answer.grade}
              actions={question.walk.strategy.actions}
              frequencies={frequencies}
              chosen={answer.chosen}
              rngAction={useRng ? actionForRng(frequencies, rng) : undefined}
              explanation={answer.explanation}
              onNext={() => next()}
              extra={
                <button className="btn" onClick={() => setShowRange(!showRange)}>
                  {showRange ? 'レンジ全体を閉じる' : 'レンジ全体を見る'}
                </button>
              }
            />
          )}
        </section>
      )}

      {question && answer && showRange && (
        <StudyView key={question.choices.join()} strategy={question.walk.strategy} heroHand={question.hand} />
      )}
    </>
  )
}

/**
 * プリフロップの説明に必要な数字を集める。相手は最後にレイズした人で、
 * その人がここまでに選んだアクションの頻度をレンジの重みにして EQ を求める
 */
function preflopExplanation(question: PreflopQuestion, frequencies: number[], chosen: number): string[] {
  const { walk, hand, cards } = question
  const hero = walk.position
  const lastRaise = walk.steps.findLast((s) => s.action.kind === 'raise' && s.position !== hero)
  const playersBehind = walk.positions.length - 1 - walk.positions.indexOf(hero)
  if (!lastRaise) {
    return explainPreflop({ hand, actions: walk.strategy.actions, frequencies, chosen, playersBehind })
  }
  const state = tableState(walk.steps, walk.positions)
  const toCall = state.currentBet - seatOf(state, hero).invested
  let equity: number | undefined
  try {
    const ids = cards.map(cardToId) as [number, number]
    equity = equityVsRange(ids, [], rangeOfPosition(walk.steps, lastRaise.position), 3000).equity
  } catch {
    equity = undefined
  }
  return explainPreflop({
    hand,
    actions: walk.strategy.actions,
    frequencies,
    chosen,
    equity,
    toCall,
    potBeforeCall: state.pot,
    aggressor: lastRaise.position,
    playersBehind,
  })
}

function PreflopQuestionTable({ question }: { question: PreflopQuestion }) {
  const { walk } = question
  const { seats, pot } = preflopSeats(walk.steps, walk.positions, walk.position, walk.position, question.cards)
  return <PokerTable seats={seats} pot={pot} />
}

function Question({
  actor,
  cards,
  board,
  actions,
  rng,
  answered,
  onChoose,
}: {
  actor: string
  /** 卓に手札とボードを出しているときは省く */
  cards?: [string, string]
  board?: string[]
  actions: Action[]
  rng?: number
  answered: boolean
  onChoose: (index: number) => void
}) {
  return (
    <div className="question">
      <div className="question-hand">
        <span className="muted small">{actor} の手番</span>
        {cards && (
          <span className="question-cards">
            {cards.map((card) => (
              <PlayingCard key={card} card={card} />
            ))}
          </span>
        )}
        {board && board.length > 0 && (
          <span className="question-board">
            <span className="muted small">ボード</span>
            <BoardCards cards={displayBoard(board)} />
          </span>
        )}
        {rng !== undefined && <span className="rng">RNG {Math.floor(rng * 100)}</span>}
      </div>
      {/* 答えたあとはボタンを消し、同じ場所に採点を出す。視線を動かさずに結果が見えるように */}
      {!answered && <ActionBar actions={actions} onChoose={onChoose} />}
    </div>
  )
}

function Feedback({
  grade,
  actions,
  frequencies,
  evs,
  evLoss,
  chosen,
  rngAction,
  onNext,
  nextLabel = '次の問題',
  extra,
  explanation,
}: {
  grade: Grade
  actions: Action[]
  frequencies: number[]
  evs?: number[]
  evLoss?: number
  chosen: number
  rngAction?: number
  onNext: () => void
  nextLabel?: string
  extra?: React.ReactNode
  /** なぜそのアクションが正解なのかの説明 */
  explanation?: string[]
}) {
  const info = GRADES.find((g) => g.grade === grade)!
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!ref.current || ref.current.offsetParent === null) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNext])
  return (
    <div className={`feedback grade-${grade}`} ref={ref}>
      <div className="feedback-head">
        <strong>{info.label}</strong>
        <span className="muted small">{info.description}</span>
        {evLoss !== undefined && evLoss > 0 && <span className="num small">EV の損失 {evLoss.toFixed(2)}bb</span>}
      </div>
      <ul className="action-list">
        <li className={`action-row static head ${evs ? 'with-ev' : ''}`}>
          <span />
          <span>アクション</span>
          <span className="num">頻度</span>
          {evs && <span className="num">EV</span>}
        </li>
        {actions.map((action, index) => (
          <li key={action.label} className={`action-row static ${evs ? 'with-ev' : ''} ${index === chosen ? 'focused' : ''}`}>
            <span className="swatch" style={{ background: actionColor(action) }} />
            <span>
              {action.label}
              {index === chosen && <span className="muted small">（選択）</span>}
              {index === rngAction && <span className="muted small">（RNG の正解）</span>}
            </span>
            <span className="num">{formatPercent(frequencies[index] ?? 0)}</span>
            {evs && <span className="num muted">{evs[index].toFixed(2)}</span>}
          </li>
        ))}
      </ul>
      {explanation && explanation.length > 0 && (
        <div className="explanation">
          <strong>{grade === 'best' ? '解説' : 'なぜ別のアクションを選ぶべきか'}</strong>
          <ul>
            {explanation.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="finished-actions">
        <button className="btn primary" onClick={onNext}>
          {nextLabel} <kbd className="action-key">Enter</kbd>
        </button>
        {extra}
      </div>
    </div>
  )
}

function ProgressCard({ progress, onReset }: { progress: Progress; onReset: () => void }) {
  const today = todayCount(progress)
  const rate = accuracy(progress)
  const total = Object.values(progress.grades).reduce((sum, n) => sum + n, 0)
  return (
    <section className="card trainer-stats">
      <header className="card-header">
        成績
        <button className="btn small-btn aside-btn" onClick={onReset}>
          リセット
        </button>
      </header>
      <div className="progress-hero">
        <div>
          <span className="muted small">連続正解</span>
          <strong className="num streak">{progress.streak}</strong>
          <span className="muted small">最高 {progress.bestStreak}</span>
        </div>
        <div>
          <span className="muted small">今日</span>
          <strong className="num">
            {today}
            <span className="muted small"> / {DAILY_GOAL} 問</span>
          </strong>
          <span className="progress-track daily">
            <span style={{ width: `${Math.min(1, today / DAILY_GOAL) * 100}%` }} />
          </span>
          {today >= DAILY_GOAL && <span className="small goal-done">今日の目標を達成しました</span>}
        </div>
      </div>
      <dl className="calc-results stats-list">
        <div>
          <dt>正答率（Best + Correct）</dt>
          <dd className="num">{rate === null ? '—' : formatPercent(rate)}</dd>
        </div>
        <div>
          <dt>これまでの回答数</dt>
          <dd className="num">{total}</dd>
        </div>
        {GRADES.map(({ grade, label }) => (
          <div key={grade}>
            <dt>{label}</dt>
            <dd className="num">{progress.grades[grade]}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

type Side = 0 | 1

interface HandState {
  heroSide: Side
  hero: [string, string]
  villain: [string, string]
  history: number[]
  node: NodeInfo
  log: string[]
}

function PostflopTrainer({
  spot,
  useRng,
  onGrade,
}: {
  spot: PostflopSpot
  useRng: boolean
  onGrade: (grade: Grade) => void
}) {
  const clientRef = useRef(new SolverClient())
  const [sideChoice, setSideChoice] = useState<'oop' | 'ip' | 'random'>('random')
  const [hand, setHand] = useState<HandState | null>(null)
  const [answer, setAnswer] = useState<{ chosen: number; grade: Grade; evLoss: number; explanation: string[] } | null>(
    null,
  )
  const [rng, setRng] = useState(rollRng)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const position = (side: Side) => (side === 0 ? spot.oop : spot.ip)

  /** 相手の手番とカードの配布を自動で進め、自分の手番か終端で止める */
  const advance = async (state: Omit<HandState, 'node'>): Promise<HandState> => {
    let { history, log } = state
    for (;;) {
      const node = await clientRef.current.node(history)
      if (node.kind === 'terminal') return { ...state, history, log, node }
      if (node.kind === 'chance') {
        const card = dealNextCard(node, [...state.hero, ...state.villain])
        history = [...history, card]
        log = [...log, `${node.board.length === 3 ? 'ターン' : 'リバー'} ${cardFromId(card)}`]
        continue
      }
      if (node.player === state.heroSide) return { ...state, history, log, node }
      const index = villainAction(node, state.villain)
      const label = toActions(node.actions, node.pot)[index].label
      history = [...history, index]
      log = [...log, `${position(node.player)}: ${label}`]
    }
  }

  const start = async () => {
    setBusy(true)
    setError('')
    setAnswer(null)
    try {
      const root = await clientRef.current.node([])
      if (root.kind !== 'player') throw new Error('ソルブ結果のルートが判断ノードではありません')
      const heroSide: Side = sideChoice === 'oop' ? 0 : sideChoice === 'ip' ? 1 : Math.random() < 0.5 ? 0 : 1
      const dealt = dealPostflopHands(root, heroSide)
      if (!dealt) throw new Error('手札を配れませんでした')
      setHand(await advance({ heroSide, ...dealt, history: [], log: [] }))
      setRng(rollRng())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const heroNode = hand?.node.kind === 'player' ? hand.node : null
  const heroCombo = heroNode && hand ? heroNode.hands.find((h) => isSameHoleCards(h.cards, hand.hero.join(''))) : undefined
  const actions = heroNode ? toActions(heroNode.actions, heroNode.pot) : []
  const evs = heroCombo ? heroCombo.actionEvs.map((ev) => toBb(ev ?? 0)) : []
  // 自分が頻度0のアクションを選んだ後は、そのハンドの到達確率が0になり EV が出ないため、頻度だけで採点する
  const evAvailable = Boolean(heroCombo && heroCombo.normalizedWeight > 0)

  const choose = (index: number) => {
    if (!heroNode || !heroCombo || answer) return
    const roll = useRng ? rng : undefined
    const result = evAvailable
      ? gradeByEv(heroCombo.strategy, evs, index, toBb(heroNode.pot), roll)
      : { grade: gradeByFrequency(heroCombo.strategy, index, roll), evLoss: 0 }
    const heroSide = hand!.heroSide
    const villainSide = heroSide === 0 ? 1 : 0
    const made = classifyHand(hand!.hero.map(cardToId) as [number, number], heroNode.board.map(cardToId)).made
    const categoryRow = breakdownNode(heroNode).made.find((row) => row.label === made)
    const explanation = explainPostflop({
      cards: hand!.hero,
      board: heroNode.board,
      actions,
      frequencies: heroCombo.strategy,
      evs,
      chosen: index,
      equity: heroCombo.equity ?? 0,
      toCall: Math.max(0, toBb(heroNode.bets[villainSide] - heroNode.bets[heroSide])),
      pot: toBb(heroNode.pot),
      categoryFrequencies: categoryRow?.frequencies,
    })
    setAnswer({ chosen: index, ...result, explanation })
    onGrade(result.grade)
  }

  const proceed = async () => {
    if (!hand || !heroNode || !answer) return
    setBusy(true)
    try {
      const label = actions[answer.chosen].label
      setHand(
        await advance({
          ...hand,
          history: [...hand.history, answer.chosen],
          log: [...hand.log, `${position(hand.heroSide)}（自分）: ${label}`],
        }),
      )
      setAnswer(null)
      setRng(rollRng())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="card">
        <div className="card-body scenario">
          <p className="muted small">
            出題するスポット: {spot.name}。相手は自分の手札の GTO 戦略どおりに動き、ターンとリバーはランダムに配られます。
          </p>
          <Segmented<'oop' | 'ip' | 'random'>
            label="自分の側"
            options={[
              { value: 'random', label: 'ランダム' },
              { value: 'oop', label: `${spot.oop}（OOP）` },
              { value: 'ip', label: `${spot.ip}（IP）` },
            ]}
            value={sideChoice}
            onChange={setSideChoice}
          />
          <div>
            <button className="btn primary" onClick={start} disabled={busy}>
              {hand ? '次のハンドを配る' : 'ハンドを配る'}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <section className="card">
          <p className="empty-note error">{error}</p>
        </section>
      )}

      {hand && (
        <section className="card table-card">
          <PokerTable
            seats={postflopSeats(spot, hand)}
            pot={toBb(hand.node.pot)}
            board={displayBoard(hand.node.board)}
          />
          {hand.log.length > 0 && (
            <div className="action-line">
              {hand.log.map((entry, i) => (
                <span key={i} className="step static log-step">
                  <span className="step-action">{entry}</span>
                </span>
              ))}
            </div>
          )}
          {heroNode ? (
            <>
              <Question
                actor={`${position(hand.heroSide)}（自分）`}
                actions={actions}
                rng={useRng ? rng : undefined}
                answered={answer !== null}
                onChoose={choose}
              />
              {answer && heroCombo && (
                <Feedback
                  grade={answer.grade}
                  actions={actions}
                  frequencies={heroCombo.strategy}
                  evs={evAvailable ? evs : undefined}
                  evLoss={answer.evLoss}
                  chosen={answer.chosen}
                  rngAction={useRng ? actionForRng(heroCombo.strategy, rng) : undefined}
                  explanation={answer.explanation}
                  onNext={proceed}
                  nextLabel="続ける"
                />
              )}
            </>
          ) : (
            <HandEnd hand={hand} spot={spot} onNext={start} />
          )}
        </section>
      )}
    </>
  )
}

/** ポストフロップの卓。ハンドに参加している2人以外はフォールド済みとして並べ、ハンドが終わったら相手の手札も開く */
function postflopSeats(spot: PostflopSpot, hand: HandState): SeatView[] {
  const heroPosition = hand.heroSide === 0 ? spot.oop : spot.ip
  const ended = hand.node.kind === 'terminal'
  const dealer = dealerOf(spot.positions)
  return seatsFromBottom(spot.positions, heroPosition).map((position) => {
    const side = position === spot.oop ? 0 : position === spot.ip ? 1 : null
    const acting = hand.node.kind === 'player' && side === hand.node.player
    return {
      position,
      dealer: position === dealer,
      stack: side === null ? null : spot.effectiveStackBb - toBb(hand.node.bets[side]),
      bet: 0,
      folded: side === null,
      acting,
      hero: position === heroPosition,
      cards: position === heroPosition ? hand.hero : side !== null && ended ? hand.villain : null,
    }
  })
}

/** 学習用なので、勝敗ではなく判断の採点だけを見せる。終わったハンドは両者の手札とボードの確認だけにする */
function HandEnd({ hand, spot, onNext }: { hand: HandState; spot: PostflopSpot; onNext: () => void }) {
  const folded = hand.log.some((entry) => entry.endsWith('Fold'))
  return (
    <div className="question">
      <div className="question-hand">
        <span className="muted small">ハンド終了{folded ? '（フォールド）' : '（ショーダウン）'}</span>
        <span className="question-board">
          <span className="muted small">自分</span>
          <BoardCards cards={hand.hero} />
          <span className="muted small">相手（{hand.heroSide === 0 ? spot.ip : spot.oop}）</span>
          <BoardCards cards={hand.villain} />
        </span>
        <span className="question-board">
          <span className="muted small">ボード</span>
          <BoardCards cards={displayBoard(hand.node.board)} />
        </span>
      </div>
      <div className="finished-actions">
        <button className="btn primary" onClick={onNext}>
          次のハンドを配る
        </button>
      </div>
    </div>
  )
}
