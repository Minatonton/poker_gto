import { useCallback, useEffect, useRef, useState } from 'react'
import { actionColor, formatPercent } from '../components/actionColors'
import { BoardCards, PlayingCard } from '../components/postflop/Cards'
import { PokerTable, type SeatView } from '../components/table/PokerTable'
import { preflopSeats } from '../components/table/preflopSeats'
import { Segmented } from '../components/Segmented'
import { StudyView } from '../components/StudyView'
import { cash6max100bb } from '../data/cash6max100bb'
import { cardFromId, displayBoard, isSameHoleCards } from '../poker/cards'
import { POSITIONS, type Position } from '../poker/preflop'
import type { PostflopSpot } from '../poker/postflopSpot'
import { seatsFromBottom } from '../poker/table'
import type { Action } from '../poker/strategy'
import { toActions, toBb } from '../solver/aggregate'
import { SolverClient } from '../solver/client'
import type { NodeInfo } from '../solver/types'
import { GRADES, actionForRng, gradeByEv, gradeByFrequency, type Grade } from '../trainer/grading'
import { dealNextCard, dealPostflopHands, villainAction } from '../trainer/postflopHand'
import { createPreflopQuestion, PREFLOP_DRILLS, type PreflopDrillKind, type PreflopQuestion } from '../trainer/preflopDrill'

type Mode = 'preflop' | 'postflop'
type Stats = Record<Grade, number>

const EMPTY_STATS: Stats = { best: 0, correct: 0, inaccuracy: 0, wrong: 0, blunder: 0 }
const STATS_KEY = 'poker-gto:trainer-stats'

/** 成績は端末のブラウザにだけ残す。消えても困らない練習の記録なので、読み書きに失敗しても無視する */
function loadStats(): Record<Mode, Stats> {
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY) ?? 'null')
    if (saved?.preflop && saved?.postflop) return saved
  } catch {
    // 保存できない環境では、その場限りの成績にする
  }
  return { preflop: { ...EMPTY_STATS }, postflop: { ...EMPTY_STATS } }
}

function saveStats(stats: Record<Mode, Stats>) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    // 同上
  }
}

interface Props {
  /** ポストフロップで直近にソルブしたスポット */
  solvedSpot: PostflopSpot | null
  onOpenPostflop: () => void
}

export function TrainerPage({ solvedSpot, onOpenPostflop }: Props) {
  const [mode, setMode] = useState<Mode>('preflop')
  const [useRng, setUseRng] = useState(false)
  const [stats, setStats] = useState(loadStats)

  const record = (grade: Grade) =>
    setStats((current) => {
      const next = { ...current, [mode]: { ...current[mode], [grade]: current[mode][grade] + 1 } }
      saveStats(next)
      return next
    })

  return (
    <>
      <div className="page-header">
        <h1>トレーナー</h1>
        <span className="caption">GTO を相手に判断し、頻度と EV の損失で採点します。</span>
      </div>

      <section className="card">
        <div className="card-body scenario">
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
            RNG を使う（出目に当たる区間のアクションだけを Best にして、混合戦略を頻度どおりに選ぶ練習をする）
          </label>
        </div>
      </section>

      <div className="trainer-layout">
        <div className="trainer-main">
          {mode === 'preflop' ? (
            <PreflopTrainer useRng={useRng} onGrade={record} />
          ) : solvedSpot ? (
            <PostflopTrainer spot={solvedSpot} useRng={useRng} onGrade={record} />
          ) : (
            <section className="card empty-state">
              <p>ポストフロップの出題には、先にポストフロップ画面でスポットをソルブしてください。</p>
              <button className="btn primary" onClick={onOpenPostflop}>
                ポストフロップを開く
              </button>
            </section>
          )}
        </div>
        <StatsCard
          stats={stats[mode]}
          onReset={() => {
            const next = { ...stats, [mode]: { ...EMPTY_STATS } }
            saveStats(next)
            setStats(next)
          }}
        />
      </div>
    </>
  )
}

const rollRng = () => Math.random()

function PreflopTrainer({ useRng, onGrade }: { useRng: boolean; onGrade: (grade: Grade) => void }) {
  const [kind, setKind] = useState<PreflopDrillKind>('rfi')
  const [seat, setSeat] = useState<Position | 'random'>('random')
  const [question, setQuestion] = useState<PreflopQuestion | null>(null)
  const [rng, setRng] = useState(rollRng)
  const [answer, setAnswer] = useState<{ chosen: number; grade: Grade } | null>(null)
  const [error, setError] = useState('')
  const [showRange, setShowRange] = useState(false)

  const next = useCallback(
    (nextKind = kind, nextSeat = seat) => {
      const created = createPreflopQuestion(cash6max100bb, nextKind, nextSeat === 'random' ? null : nextSeat)
      setError(created ? '' : 'この席には、この種類の手番が来ません。席か出題の種類を変えてください。')
      setQuestion(created)
      setAnswer(null)
      setShowRange(false)
      setRng(rollRng())
    },
    [kind, seat],
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
    setAnswer({ chosen: index, grade })
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
            options={[{ value: 'random', label: 'ランダム' }, ...POSITIONS.map((p) => ({ value: p, label: p }))]}
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

function PreflopQuestionTable({ question }: { question: PreflopQuestion }) {
  const { seats, pot } = preflopSeats(question.walk.steps, question.walk.position, question.walk.position, question.cards)
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
      <div className="question-actions">
        {actions.map((action, index) => (
          <button
            key={action.label}
            className="choice answer"
            style={{ '--action': actionColor(action) } as React.CSSProperties}
            disabled={answered}
            onClick={() => onChoose(index)}
          >
            <span className="choice-label">{action.label}</span>
          </button>
        ))}
      </div>
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
}) {
  const info = GRADES.find((g) => g.grade === grade)!
  return (
    <div className={`feedback grade-${grade}`}>
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
      <div className="finished-actions">
        <button className="btn primary" onClick={onNext}>
          {nextLabel}
        </button>
        {extra}
      </div>
    </div>
  )
}

function StatsCard({ stats, onReset }: { stats: Stats; onReset: () => void }) {
  const total = Object.values(stats).reduce((sum, n) => sum + n, 0)
  const good = stats.best + stats.correct
  return (
    <section className="card trainer-stats">
      <header className="card-header">
        成績
        <button className="btn small-btn aside-btn" onClick={onReset}>
          リセット
        </button>
      </header>
      <dl className="calc-results stats-list">
        <div>
          <dt>回答数</dt>
          <dd className="num">{total}</dd>
        </div>
        <div>
          <dt>Best + Correct の割合</dt>
          <dd className="num">{total ? formatPercent(good / total) : '—'}</dd>
        </div>
        {GRADES.map(({ grade, label }) => (
          <div key={grade}>
            <dt>{label}</dt>
            <dd className="num">{stats[grade]}</dd>
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
  const [answer, setAnswer] = useState<{ chosen: number; grade: Grade; evLoss: number } | null>(null)
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
    setAnswer({ chosen: index, ...result })
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
  return seatsFromBottom(heroPosition).map((position) => {
    const side = position === spot.oop ? 0 : position === spot.ip ? 1 : null
    const acting = hand.node.kind === 'player' && side === hand.node.player
    return {
      position,
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
