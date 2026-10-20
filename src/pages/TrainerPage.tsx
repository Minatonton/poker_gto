import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { actionColor, formatPercent } from '../components/actionColors'
import { BoardCards } from '../components/postflop/Cards'
import { GameScreen, type DockTab } from '../components/game/GameScreen'
import { playCue } from '../components/game/sound'
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
import { GRADES, actionForRng, gradeByEv, gradeByFrequency, withSizing, type Grade } from '../trainer/grading'
import { isGtoSize, preflopSizeChoices } from '../poker/betSizing'
import {
  accuracy,
  DAILY_GOAL,
  emptyProgress,
  normalizeProgress,
  rankOf,
  recordAnswer,
  todayCount,
  type Progress,
} from '../trainer/progress'
import { ActionBar } from '../components/table/ActionBar'
import { dealNextCard, dealPostflopHands, villainAction } from '../trainer/postflopHand'
import {
  createPreflopQuestion,
  PREFLOP_DRILLS,
  type PreflopDrillKind,
  type PreflopQuestion,
} from '../trainer/preflopDrill'
import { explainPostflop, explainPreflop } from '../trainer/explain'
import { equityVsRange } from '../poker/equity'
import { dealerOf, seatOf, seatsFromBottom, tableState } from '../poker/table'
import { classifyHand } from '../poker/handCategory'
import { breakdownNode } from '../solver/breakdown'
import { SESSION_SIZE, summarize, type SessionAnswer } from '../trainer/session'

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

/** 直前の1問で得たもの。採点カードに添える */
interface Gain {
  xp: number
  /** ランクが上がったら新しいランクの名前 */
  rankUp: string | null
}

/** 出題の種類ごとの画面に共通して渡すもの */
interface ShellProps {
  useRng: boolean
  progress: Progress
  onGrade: (grade: Grade) => void
  /** 出題タブの先頭に置く、出題の種類と RNG の設定 */
  settings: ReactNode
  statsTab: DockTab
  hud: ReactNode
  gain: Gain | null
  /**
   * 次の問題へ進む前に通す。10問のチャレンジが終わっていたら、進む代わりにまとめを出し、
   * まとめを閉じたときに run を呼ぶ
   */
  gate: (run: () => void) => void
  /** チャレンジのまとめ。出しているあいだは卓に重ね、操作は「次の10問へ」だけにする */
  summary: { card: ReactNode; onClose: () => void } | null
}

const isGood = (grade: Grade) => grade === 'best' || grade === 'correct'
const STREAK_CUE_FROM = 3

export function TrainerPage({ solution, solvedSpot, onOpenAnalyze }: Props) {
  const [mode, setMode] = useState<Mode>('preflop')
  const [useRng, setUseRng] = useState(false)
  const [stats, setStats] = useState(loadStats)
  const [session, setSession] = useState<SessionAnswer[]>([])
  const [gain, setGain] = useState<Gain | null>(null)
  const [pending, setPending] = useState<{ run: () => void } | null>(null)
  const progress = stats[mode]

  const record = (grade: Grade) => {
    const before = stats[mode]
    const after = recordAnswer(before, grade)
    const next = { ...stats, [mode]: after }
    saveStats(next)
    setStats(next)
    const xp = after.xp - before.xp
    const rank = rankOf(after.xp).name
    const rankUp = rank !== rankOf(before.xp).name ? rank : null
    setSession([...session, { grade, xp }])
    setGain({ xp, rankUp })
    playCue(!isGood(grade) ? 'bad' : rankUp || after.streak >= STREAK_CUE_FROM ? 'streak' : 'good')
  }
  const changeMode = (next: Mode) => {
    setMode(next)
    setSession([])
    setPending(null)
  }
  const gate = (run: () => void) => {
    if (session.length >= SESSION_SIZE) {
      setPending({ run })
      playCue('streak')
    } else {
      run()
    }
  }
  const reset = () => {
    const next = { ...stats, [mode]: emptyProgress() }
    saveStats(next)
    setStats(next)
  }

  const shell: ShellProps = {
    useRng,
    progress,
    onGrade: record,
    settings: (
      <>
        <Segmented<Mode>
          label="出題"
          options={[
            { value: 'preflop', label: 'プリフロップ' },
            { value: 'postflop', label: 'ポストフロップ' },
          ]}
          value={mode}
          onChange={changeMode}
        />
        <label className="checkbox-row">
          <input type="checkbox" checked={useRng} onChange={(e) => setUseRng(e.target.checked)} />
          RNG を使う
          <span className="muted small">出目に当たるアクションだけを Best にして、混合戦略を頻度どおりに選ぶ練習</span>
        </label>
      </>
    ),
    statsTab: { id: 'stats', label: '成績', content: <ProgressCard progress={progress} onReset={reset} /> },
    hud: <TrainerHud progress={progress} session={session} />,
    gain,
    gate,
    summary: pending && {
      card: <SessionCard answers={session} progress={progress} />,
      onClose: () => {
        setSession([])
        setPending(null)
        pending.run()
      },
    },
  }

  if (mode === 'preflop') return <PreflopTrainer solution={solution} {...shell} />
  if (solvedSpot) return <PostflopTrainer spot={solvedSpot} {...shell} />
  return (
    <GameScreen
      coach={<strong>ポストフロップの出題には、先に「分析」でフロップを計算してください。</strong>}
      hud={shell.hud}
      table={<div className="stage-empty">計算したスポットで、GTO を相手に1ハンドずつ打てます。</div>}
      controls={
        <div className="finished-actions">
          <button className="btn primary large" onClick={onOpenAnalyze}>
            分析を開く
          </button>
        </div>
      }
      tabs={[settingsTab(shell.settings), shell.statsTab]}
    />
  )
}

function settingsTab(children: ReactNode): DockTab {
  return {
    id: 'settings',
    label: '出題',
    content: (
      <section className="card">
        <div className="card-body scenario">{children}</div>
      </section>
    ),
  }
}

/** 卓の右上に置く、ランク・チャレンジの進み具合・連続正解・今日の問題数。数字が変わった瞬間だけ跳ねさせる */
function TrainerHud({ progress, session }: { progress: Progress; session: SessionAnswer[] }) {
  const today = todayCount(progress)
  const rank = rankOf(progress.xp)
  return (
    <div className="trainer-hud">
      <div
        className="hud-rank"
        title={rank.next ? `${rank.next.name} まであと ${rank.next.remaining} XP` : '最上位のランクです'}
      >
        <span className="hud-rank-name" key={rank.name}>
          {rank.name}
        </span>
        <span className="hud-rank-track">
          <span style={{ width: `${rank.progress * 100}%` }} />
        </span>
      </div>
      <ol className="session-dots" aria-label={`チャレンジ ${session.length} / ${SESSION_SIZE} 問`}>
        {Array.from({ length: SESSION_SIZE }, (_, i) => (
          <li key={i} className={session[i] ? `grade-${session[i].grade}` : ''} />
        ))}
      </ol>
      <div className="hud-streak" title={`最高 ${progress.bestStreak}`}>
        <span className="hud-label">連続</span>
        <strong key={progress.streak} className={`num ${progress.streak > 0 ? 'bump' : ''}`}>
          {progress.streak}
        </strong>
      </div>
      <div className="hud-daily">
        <span className="hud-label">
          今日 <strong className="num">{today}</strong> / {DAILY_GOAL}
        </span>
        <span className={`hud-daily-track ${today >= DAILY_GOAL ? 'done' : ''}`}>
          <span style={{ width: `${Math.min(1, today / DAILY_GOAL) * 100}%` }} />
        </span>
      </div>
    </div>
  )
}

/** 10問のチャレンジのまとめ。ゲームのラウンドの結果画面のように、評価を大きく見せてから内訳を出す */
function SessionCard({ answers, progress }: { answers: SessionAnswer[]; progress: Progress }) {
  const summary = summarize(answers)
  const rank = rankOf(progress.xp)
  return (
    <div className={`result-card session-card score-${summary.score}`} role="status">
      <div className="session-score">
        <span className="muted small">チャレンジ結果</span>
        <strong className="session-grade">{summary.score}</strong>
      </div>
      <ol className="session-dots large">
        {answers.map((answer, i) => (
          <li key={i} className={`grade-${answer.grade}`} />
        ))}
      </ol>
      <dl className="session-stats">
        <div>
          <dt>正解</dt>
          <dd className="num">
            {summary.good} / {summary.answered}
          </dd>
        </div>
        <div>
          <dt>最長の連続正解</dt>
          <dd className="num">{summary.bestStreak}</dd>
        </div>
        <div>
          <dt>獲得 XP</dt>
          <dd className="num">+{summary.xp}</dd>
        </div>
      </dl>
      <p className="muted small">
        いまのランクは {rank.name}
        {rank.next ? `。${rank.next.name} まであと ${rank.next.remaining} XP` : '。最上位です'}
      </p>
    </div>
  )
}

const rollRng = () => Math.random()

/** レイズの額を選ばせる候補。データの額を答えとして、ほかの候補と並べる */
function raiseSizesOf(question: PreflopQuestion): number[] | undefined {
  const raise = question.walk.strategy.actions.find((a) => a.kind === 'raise')
  if (raise?.amount === undefined) return undefined
  return preflopSizeChoices(raise.amount, tableState(question.walk.steps, question.walk.positions).currentBet)
}

type PreflopAnswer = { chosen: number; grade: Grade; explanation: string[]; amount?: number; sizeMiss?: boolean }

function PreflopTrainer({
  solution,
  useRng,
  progress,
  onGrade,
  settings,
  statsTab,
  hud,
  gain,
  gate,
  summary,
}: ShellProps & { solution: PreflopSolution }) {
  const [kind, setKind] = useState<PreflopDrillKind>('rfi')
  const [seat, setSeat] = useState<Position | 'random'>('random')
  const [question, setQuestion] = useState<PreflopQuestion | null>(null)
  const [rng, setRng] = useState(rollRng)
  const [answer, setAnswer] = useState<PreflopAnswer | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('stats')

  const next = useCallback(
    (nextKind = kind, nextSeat = seat) => {
      const created = createPreflopQuestion(solution, nextKind, nextSeat === 'random' ? null : nextSeat)
      setError(created ? '' : 'この席には、この種類の手番が来ません。席か出題の種類を変えてください。')
      setQuestion(created)
      setAnswer(null)
      setRng(rollRng())
      setTab((current) => (current === 'range' ? 'stats' : current))
    },
    [kind, seat, solution],
  )

  useEffect(() => {
    next()
    // 初回の出題だけを作る。以降は「次の問題」や条件の変更で作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const frequencies = question ? (question.walk.strategy.frequencies.get(question.hand) ?? []) : []
  const choose = (index: number, amount?: number) => {
    if (!question || answer) return
    const gtoAmount = question.walk.strategy.actions[index].amount
    const sizeIsGto = amount === undefined || gtoAmount === undefined || isGtoSize(amount, gtoAmount)
    const actionGrade = gradeByFrequency(frequencies, index, useRng ? rng : undefined)
    const grade = withSizing(actionGrade, sizeIsGto)
    // レイズ自体が間違いのときは、サイズより先に直すことがあるので、サイズの説明は出さない
    const sizeMatters = !sizeIsGto && grade !== actionGrade
    const sizeLine = sizeMatters
      ? [
          `レイズは正解ですが、サイズは ${gtoAmount}bb が GTO の基準です。選んだ ${amount}bb では、${
            amount! > gtoAmount!
              ? '弱い手に降りられやすく、強い手にだけ続けられます'
              : '相手に安くついて来られ、主導権の価値が下がります'
          }。`,
        ]
      : []
    setAnswer({
      chosen: index,
      grade,
      amount,
      sizeMiss: sizeMatters,
      explanation: [...sizeLine, ...preflopExplanation(question, frequencies, index)],
    })
    setTab('range')
    onGrade(grade)
  }

  const walk = question?.walk
  const table = walk && preflopSeats(walk.steps, walk.positions, walk.position, walk.position, question.cards)

  return (
    <GameScreen
      coach={
        error ? (
          <span className="error">{error}</span>
        ) : question ? (
          <>
            <strong>{question.walk.position} のあなたの番。</strong>
            {question.hand} をどうしますか？
            {useRng && <span className="rng">RNG {Math.floor(rng * 100)}</span>}
          </>
        ) : null
      }
      hud={hud}
      table={
        table ? (
          <PokerTable
            key={question.choices.join() + question.hand}
            seats={table.seats}
            pot={table.pot}
            overlay={
              summary?.card ??
              (answer && (
                <ResultCard
                  grade={answer.grade}
                  streak={progress.streak}
                  gain={gain}
                  chosenAmount={answer.amount}
                  sizeMiss={answer.sizeMiss}
                  actions={question.walk.strategy.actions}
                  frequencies={frequencies}
                  chosen={answer.chosen}
                  rngAction={useRng ? actionForRng(frequencies, rng) : undefined}
                  explanation={answer.explanation}
                />
              ))
            }
          />
        ) : (
          <div className="stage-empty">出題タブで、席か出題の種類を変えてください。</div>
        )
      }
      controls={
        summary ? (
          <NextBar label="次の10問へ" onNext={summary.onClose} />
        ) : question && !answer ? (
          <ActionBar actions={question.walk.strategy.actions} sizeChoices={raiseSizesOf(question)} onChoose={choose} />
        ) : (
          <NextBar label="次の問題" onNext={() => gate(() => next())} />
        )
      }
      tabs={[
        statsTab,
        settingsTab(
          <>
            {settings}
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
              options={[
                { value: 'random', label: 'ランダム' },
                ...solution.positions.map((p) => ({ value: p, label: p })),
              ]}
              value={seat}
              onChange={(value) => {
                setSeat(value)
                next(kind, value)
              }}
            />
          </>,
        ),
        ...(question && answer
          ? [
              {
                id: 'range',
                label: 'レンジ',
                content: (
                  <StudyView key={question.choices.join()} strategy={question.walk.strategy} heroHand={question.hand} />
                ),
              },
            ]
          : []),
      ]}
      activeTab={tab}
      onTabChange={setTab}
    />
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

/** 次へ進むボタン。答えたあとは Enter かスペースでも進めるようにして、手をキーボードから離さずに続けられるようにする */
function NextBar({ label, onNext, disabled = false }: { label: string; onNext: () => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (disabled) return
    const onKey = (event: KeyboardEvent) => {
      // 分析と壁打ちは切り替えても画面に残しているため、見えていない画面のボタンはキーに反応させない
      if (!ref.current || ref.current.offsetParent === null) return
      const target = event.target as HTMLElement | null
      // ボタンにフォーカスがあっても Enter は「次へ」に使う。タブを押した直後に Enter が効かなくなるのを防ぐため
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNext, disabled])
  return (
    <div className="finished-actions next-bar" ref={ref}>
      <button className="btn primary large" onClick={onNext} disabled={disabled}>
        {label} <kbd className="action-key">Enter</kbd>
      </button>
    </div>
  )
}

/** 答えた直後に卓の上へ重ねる採点。最初に評価を大きく見せ、頻度と理由をその下に続ける */
function ResultCard({
  grade,
  streak,
  gain,
  chosenAmount,
  sizeMiss = false,
  actions,
  frequencies,
  evs,
  evLoss,
  chosen,
  rngAction,
  explanation,
}: {
  grade: Grade
  streak: number
  gain: Gain | null
  /** 額を選ばせたときの、選んだ額（bb） */
  chosenAmount?: number
  /** アクションは合っていて、サイズだけで評価を下げたとき */
  sizeMiss?: boolean
  actions: Action[]
  frequencies: number[]
  evs?: number[]
  evLoss?: number
  chosen: number
  rngAction?: number
  explanation: string[]
}) {
  const info = GRADES.find((g) => g.grade === grade)!
  return (
    <div className={`result-card grade-${grade}`} role="status">
      <div className="result-head">
        <strong className="result-grade">{info.label}</strong>
        <span className="result-description">
          {sizeMiss ? 'アクションは正解。サイズが GTO と違う' : info.description}
        </span>
        {isGood(grade) && streak >= 2 && <span className="result-streak num">{streak} 連続</span>}
        {gain && <span className="result-xp num">+{gain.xp} XP</span>}
      </div>
      {gain?.rankUp && <p className="rank-up">ランクアップ！ {gain.rankUp} になりました</p>}
      {evLoss !== undefined && evLoss > 0 && <p className="result-loss num">EV の損失 {evLoss.toFixed(2)}bb</p>}
      <ul className="advice-bars result-bars">
        {actions.map((action, index) => (
          <li key={action.label} className={index === chosen ? 'chosen' : ''}>
            <span className="advice-bar-label">
              {action.label}
              {index === chosen && (
                <span className="muted small"> あなた{chosenAmount !== undefined && `（${chosenAmount}bb）`}</span>
              )}
              {index === rngAction && <span className="muted small"> RNG</span>}
            </span>
            <span className="advice-bar-track">
              <span style={{ width: `${(frequencies[index] ?? 0) * 100}%`, background: actionColor(action) }} />
            </span>
            <span className="num">{formatPercent(frequencies[index] ?? 0)}</span>
            {evs && <span className="num muted advice-ev">{evs[index].toFixed(2)}bb</span>}
          </li>
        ))}
      </ul>
      {explanation.length > 0 && (
        <div className="result-why">
          <strong>{isGood(grade) ? '解説' : 'なぜ別のアクションを選ぶべきか'}</strong>
          <ul>
            {explanation.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
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

type PostflopAnswer = { chosen: number; grade: Grade; evLoss: number; explanation: string[] }

function PostflopTrainer({
  spot,
  useRng,
  progress,
  onGrade,
  settings,
  statsTab,
  hud,
  gain,
  gate,
  summary,
}: ShellProps & { spot: PostflopSpot }) {
  const clientRef = useRef(new SolverClient())
  const [sideChoice, setSideChoice] = useState<'oop' | 'ip' | 'random'>('random')
  const [hand, setHand] = useState<HandState | null>(null)
  const [answer, setAnswer] = useState<PostflopAnswer | null>(null)
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
      playCue('deal')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const heroNode = hand?.node.kind === 'player' ? hand.node : null
  const heroCombo =
    heroNode && hand ? heroNode.hands.find((h) => isSameHoleCards(h.cards, hand.hero.join(''))) : undefined
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

  const lastLog = hand?.log.at(-1)
  const coach = error ? (
    <span className="error">{error}</span>
  ) : !hand ? (
    <>
      <strong>{spot.name} を打ちます。</strong>相手は GTO どおりに動き、ターンとリバーはランダムに配られます。
    </>
  ) : heroNode ? (
    <>
      <strong>{position(hand.heroSide)} のあなたの番。</strong>
      {lastLog && <span className="coach-hint">直前: {lastLog}</span>}
      {useRng && <span className="rng">RNG {Math.floor(rng * 100)}</span>}
    </>
  ) : (
    <strong>
      ハンド終了{hand.log.some((entry) => entry.endsWith('Fold')) ? '（フォールド）' : '（ショーダウン）'}
    </strong>
  )

  return (
    <GameScreen
      coach={coach}
      hud={hud}
      table={
        <PokerTable
          seats={hand ? postflopSeats(spot, hand) : idleSeats(spot)}
          pot={hand ? toBb(hand.node.pot) : spot.potBb}
          board={hand ? displayBoard(hand.node.board) : []}
          overlay={
            summary?.card ??
            (answer && heroCombo ? (
              <ResultCard
                grade={answer.grade}
                streak={progress.streak}
                gain={gain}
                actions={actions}
                frequencies={heroCombo.strategy}
                evs={evAvailable ? evs : undefined}
                evLoss={answer.evLoss}
                chosen={answer.chosen}
                rngAction={useRng ? actionForRng(heroCombo.strategy, rng) : undefined}
                explanation={answer.explanation}
              />
            ) : (
              hand && !heroNode && <HandEnd hand={hand} spot={spot} />
            ))
          }
        />
      }
      controls={
        summary ? (
          <NextBar label="次の10問へ" onNext={summary.onClose} />
        ) : !hand ? (
          <NextBar label="ハンドを配る" onNext={start} disabled={busy} />
        ) : heroNode && !answer ? (
          <ActionBar actions={actions} onChoose={choose} disabled={busy} />
        ) : answer ? (
          <NextBar label="続ける" onNext={() => gate(proceed)} disabled={busy} />
        ) : (
          <NextBar label="次のハンドを配る" onNext={() => gate(start)} disabled={busy} />
        )
      }
      tabs={[
        statsTab,
        settingsTab(
          <>
            {settings}
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
          </>,
        ),
        {
          id: 'history',
          label: '履歴',
          content: (
            <section className="card">
              <header className="card-header">このハンドの流れ</header>
              <ol className="history-list">
                {(hand?.log ?? []).length === 0 && (
                  <li className="muted small history-empty">まだアクションはありません</li>
                )}
                {hand?.log.map((entry, i) => (
                  <li key={i} className="history-row static">
                    {entry}
                  </li>
                ))}
              </ol>
            </section>
          ),
        },
      ]}
    />
  )
}

/** 配る前の卓。ハンドに参加する2人だけを座らせておく */
function idleSeats(spot: PostflopSpot): SeatView[] {
  const dealer = dealerOf(spot.positions)
  return seatsFromBottom(spot.positions, spot.ip).map((position) => ({
    position,
    dealer: position === dealer,
    stack: position === spot.oop || position === spot.ip ? spot.effectiveStackBb : null,
    bet: 0,
    folded: position !== spot.oop && position !== spot.ip,
    acting: false,
    hero: false,
    cards: null,
  }))
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
function HandEnd({ hand, spot }: { hand: HandState; spot: PostflopSpot }) {
  return (
    <div className="result-card hand-end" role="status">
      <div className="result-head">
        <strong className="result-grade">ハンド終了</strong>
      </div>
      <div className="hand-end-cards">
        <span className="muted small">あなた</span>
        <BoardCards cards={hand.hero} />
        <span className="muted small">相手（{hand.heroSide === 0 ? spot.ip : spot.oop}）</span>
        <BoardCards cards={hand.villain} />
      </div>
      <div className="hand-end-cards">
        <span className="muted small">ボード</span>
        <BoardCards cards={displayBoard(hand.node.board)} />
      </div>
    </div>
  )
}
