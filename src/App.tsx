import { useMemo, useState } from 'react'
import {
  ANALYZE_VIEWS,
  PRACTICE_VIEWS,
  SECTIONS,
  type AnalyzeView,
  type HandStep,
  type PracticeView,
  type Section,
} from './app/navigation'
import { formatPercent } from './components/actionColors'
import { PostflopView } from './components/postflop/PostflopView'
import { cashSolution, MAX_PLAYERS, MIN_PLAYERS } from './data/cashSolutions'
import { LearnPage } from './pages/LearnPage'
import { PreflopPage } from './pages/PreflopPage'
import { RangeDrillPage } from './pages/RangeDrillPage'
import { ReportPage } from './pages/ReportPage'
import { ReviewPage } from './pages/ReviewPage'
import { TrainerPage } from './pages/TrainerPage'
import { parseHero, type HeroInput } from './poker/hero'
import type { PostflopSpot } from './poker/postflopSpot'
import { walkPreflop } from './poker/preflop'
import { choicesForLine, lineOfWalk, type PreflopLine } from './poker/preflopLine'
import type { ActionKind } from './poker/strategy'
import { loadReviews, newReview, saveReviews, type HandReview } from './review/reviews'

const PLAYER_COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i)

function SubTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="sub-tabs" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const [section, setSection] = useState<Section>('analyze')
  const [analyzeView, setAnalyzeView] = useState<AnalyzeView>('hand')
  const [handStep, setHandStep] = useState<HandStep>('preflop')
  const [practiceView, setPracticeView] = useState<PracticeView>('trainer')
  const [players, setPlayers] = useState(6)
  const solution = useMemo(() => cashSolution(players), [players])
  const [choices, setChoices] = useState<ActionKind[]>([])
  const [postflopSpot, setPostflopSpot] = useState<{ id: number; spot: PostflopSpot } | null>(null)
  const [heroInput, setHeroInput] = useState<HeroInput>({ position: null, cardsText: '' })
  // 「応じた人」だけを選んでアクションが未定のときは、辿ったラインからは選択を読み戻せないため、
  // 選択欄で選んだ内容を別に持つ。アクションラインで直接進めたら、辿ったラインの表示に戻す
  const [pickedLine, setPickedLine] = useState<PreflopLine | null>(null)
  const [solvedSpot, setSolvedSpot] = useState<PostflopSpot | null>(null)
  const [reviews, setReviews] = useState(loadReviews)
  const [selectedReview, setSelectedReview] = useState<string | null>(null)

  const walk = useMemo(() => walkPreflop(solution, choices), [solution, choices])
  const line = useMemo(() => pickedLine ?? lineOfWalk(walk), [pickedLine, walk])
  const hero = useMemo(() => parseHero(heroInput), [heroInput])

  // 人数を変えると席の名前が変わるため、それまでのラインと、卓にいない自分の席は捨てる
  const changePlayers = (next: number) => {
    const nextPositions = cashSolution(next).positions
    setPlayers(next)
    setChoices([])
    setPickedLine(null)
    setHandStep('preflop')
    if (heroInput.position && !nextPositions.includes(heroInput.position)) {
      setHeroInput({ ...heroInput, position: null })
    }
  }

  const navigate = (next: ActionKind[]) => {
    setPickedLine(null)
    setChoices(next)
  }

  const changeReviews = (next: HandReview[]) => {
    setReviews(next)
    saveReviews(next)
  }

  /** いまの卓の状態を記録として残す。手番が自分なら、そのときの GTO の頻度も書き込む */
  const recordHand = () => {
    const heroFrequencies =
      walk.status === 'deciding' && hero.handClass && walk.position === hero.position
        ? walk.strategy.frequencies.get(hero.handClass)
        : undefined
    const gtoSummary =
      walk.status === 'deciding' && heroFrequencies
        ? `${hero.handClass}: ` +
          walk.strategy.actions.map((a, i) => `${a.label} ${formatPercent(heroFrequencies[i])}`).join(' / ')
        : ''
    const review = newReview({
      players,
      choices,
      heroPosition: hero.position,
      heroCards: hero.cards?.join('') ?? '',
      gtoSummary,
    })
    changeReviews([review, ...reviews])
    setSelectedReview(review.id)
    setSection('practice')
    setPracticeView('review')
  }

  const openReview = (review: HandReview) => {
    setPlayers(review.players)
    setPickedLine(null)
    setChoices(review.choices)
    setHeroInput({ position: review.heroPosition, cardsText: review.heroCards })
    setSection('analyze')
    setAnalyzeView('hand')
    setHandStep('preflop')
  }

  const solveSpot = (spot: PostflopSpot) => {
    setPostflopSpot((current) => ({ id: (current?.id ?? 0) + 1, spot }))
    setHandStep('postflop')
  }

  const openPreflop = () => {
    setSection('analyze')
    setAnalyzeView('hand')
    setHandStep('preflop')
  }

  return (
    <>
      <header className="app-header">
        <span className="brand">Poker GTO</span>
        <nav className="section-tabs" aria-label="画面">
          {SECTIONS.map((item) => (
            <button
              key={item.section}
              className="section-tab"
              aria-current={section === item.section ? 'page' : undefined}
              onClick={() => setSection(item.section)}
            >
              <span className="section-label">{item.label}</span>
              <span className="section-description">{item.description}</span>
            </button>
          ))}
        </nav>
        <label className="players-select">
          人数
          <select value={players} onChange={(e) => changePlayers(Number(e.target.value))}>
            {PLAYER_COUNTS.map((n) => (
              <option key={n} value={n}>
                {n === 2 ? 'ヘッズアップ' : `${n}人`}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="page" hidden={section !== 'analyze'}>
        <SubTabs options={ANALYZE_VIEWS} value={analyzeView} onChange={setAnalyzeView} />

        <div hidden={analyzeView !== 'hand'} className="page-stack">
          <ol className="steps" aria-label="分析の手順">
            <li>
              <button aria-current={handStep === 'preflop' ? 'step' : undefined} onClick={() => setHandStep('preflop')}>
                <span className="step-number">1</span> プリフロップを入力
              </button>
            </li>
            <li>
              <button
                aria-current={handStep === 'postflop' ? 'step' : undefined}
                onClick={() => setHandStep('postflop')}
                disabled={!postflopSpot}
                title={postflopSpot ? undefined : 'プリフロップでフロップまで進むと選べます'}
              >
                <span className="step-number">2</span> フロップ以降をソルブ
              </button>
            </li>
          </ol>

          <div hidden={handStep !== 'preflop'} className="page-stack">
            <PreflopPage
              solution={solution}
              walk={walk}
              choices={choices}
              line={line}
              onLine={(next) => {
                setPickedLine(next)
                setChoices(choicesForLine(solution, next))
              }}
              onNavigate={navigate}
              heroInput={heroInput}
              hero={hero}
              onHeroInput={setHeroInput}
              onSolveSpot={solveSpot}
              onRecord={recordHand}
            />
          </div>

          {/* ソルブ結果を保つため、手順を切り替えてもポストフロップの画面はアンマウントしない */}
          <div hidden={handStep !== 'postflop'} className="page-stack">
            {postflopSpot && (
              <>
                <div className="page-header">
                  <h1>{postflopSpot.spot.name}</h1>
                  <button className="btn small-btn" onClick={() => setHandStep('preflop')}>
                    プリフロップに戻る
                  </button>
                </div>
                <PostflopView
                  key={postflopSpot.id}
                  spot={postflopSpot.spot}
                  hero={hero}
                  onSolved={() => setSolvedSpot(postflopSpot.spot)}
                />
              </>
            )}
          </div>
        </div>

        <div hidden={analyzeView !== 'compare'} className="page-stack">
          <ReportPage spot={postflopSpot?.spot ?? null} onOpenPreflop={openPreflop} />
        </div>
      </main>

      <main className="page" hidden={section !== 'practice'}>
        <SubTabs options={PRACTICE_VIEWS} value={practiceView} onChange={setPracticeView} />
        <div hidden={practiceView !== 'trainer'} className="page-stack">
          <TrainerPage key={players} solution={solution} solvedSpot={solvedSpot} onOpenAnalyze={openPreflop} />
        </div>
        <div hidden={practiceView !== 'drill'} className="page-stack">
          <RangeDrillPage key={players} solution={solution} />
        </div>
        <div hidden={practiceView !== 'review'} className="page-stack">
          <ReviewPage
            reviews={reviews}
            selectedId={selectedReview}
            onSelect={setSelectedReview}
            onChange={changeReviews}
            onOpen={openReview}
          />
        </div>
      </main>

      <main className="page" hidden={section !== 'learn'}>
        <LearnPage />
      </main>
    </>
  )
}
