import { useMemo, useState } from 'react'
import {
  ANALYZE_VIEWS,
  PRACTICE_VIEWS,
  SECTIONS,
  type AnalyzeView,
  type PracticeView,
  type Section,
} from './app/navigation'
import { formatPercent } from './components/actionColors'
import { setSoundEnabled, useSoundEnabled } from './components/game/sound'
import { cashSolution, MAX_PLAYERS, MIN_PLAYERS } from './data/cashSolutions'
import { LearnPage } from './pages/LearnPage'
import { PostflopHand } from './pages/analyze/PostflopHand'
import { PreflopHand } from './pages/analyze/PreflopHand'
import { RangeDrillPage } from './pages/RangeDrillPage'
import { ReportPage } from './pages/ReportPage'
import { ReviewPage } from './pages/ReviewPage'
import { TrainerPage } from './pages/TrainerPage'
import { parseHero, type HeroInput } from './poker/hero'
import { spotFromWalk, type PostflopSpot } from './poker/postflopSpot'
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
  const [practiceView, setPracticeView] = useState<PracticeView>('trainer')
  const [players, setPlayers] = useState(6)
  const solution = useMemo(() => cashSolution(players), [players])
  const [choices, setChoices] = useState<ActionKind[]>([])
  const [heroInput, setHeroInput] = useState<HeroInput>({ position: null, cardsText: '' })
  // 「応じた人」だけを選んでアクションが未定のときは、辿ったラインからは選択を読み戻せないため、
  // 選択欄で選んだ内容を別に持つ。アクションラインで直接進めたら、辿ったラインの表示に戻す
  const [pickedLine, setPickedLine] = useState<PreflopLine | null>(null)
  const [solvedSpot, setSolvedSpot] = useState<PostflopSpot | null>(null)
  const [reviews, setReviews] = useState(loadReviews)
  const sound = useSoundEnabled()
  const [selectedReview, setSelectedReview] = useState<string | null>(null)

  const walk = useMemo(() => walkPreflop(solution, choices), [solution, choices])
  const line = useMemo(() => pickedLine ?? lineOfWalk(walk), [pickedLine, walk])
  const hero = useMemo(() => parseHero(heroInput), [heroInput])
  const spotAtFlop = useMemo(() => spotFromWalk(walk), [walk])

  // 人数を変えると席の名前が変わるため、それまでのラインと、卓にいない自分の席は捨てる
  const changePlayers = (next: number) => {
    const nextPositions = cashSolution(next).positions
    setPlayers(next)
    setChoices([])
    setPickedLine(null)
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
  }

  const openAnalyze = () => {
    setSection('analyze')
    setAnalyzeView('hand')
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">Poker GTO</span>
        <nav className="section-tabs" aria-label="画面">
          {SECTIONS.map((item) => (
            <button
              key={item.section}
              className="section-tab"
              aria-current={section === item.section ? 'page' : undefined}
              title={item.description}
              onClick={() => setSection(item.section)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {section === 'analyze' && <SubTabs options={ANALYZE_VIEWS} value={analyzeView} onChange={setAnalyzeView} />}
        {section === 'practice' && <SubTabs options={PRACTICE_VIEWS} value={practiceView} onChange={setPracticeView} />}
        <button
          className="sound-toggle"
          aria-pressed={sound}
          onClick={() => setSoundEnabled(!sound)}
          title="効果音のオンとオフ"
        >
          {sound ? '音あり' : '音なし'}
        </button>
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
        <div hidden={analyzeView !== 'hand'} className="view game">
          {walk.status === 'finished' && spotAtFlop ? (
            // ラインが変わったらソルブ結果も別物になるため、ラインごとに作り直す
            <PostflopHand
              key={`${players}-${choices.join()}`}
              spot={spotAtFlop}
              walk={walk}
              choices={choices}
              onNavigate={navigate}
              heroInput={heroInput}
              hero={hero}
              onHeroInput={setHeroInput}
              onRecord={recordHand}
              onSolved={() => setSolvedSpot(spotAtFlop)}
            />
          ) : (
            <PreflopHand
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
              onRecord={recordHand}
            />
          )}
        </div>

        <div hidden={analyzeView !== 'compare'} className="view scroll">
          <ReportPage spot={spotAtFlop} onOpenPreflop={openAnalyze} />
        </div>
      </main>

      <main className="page" hidden={section !== 'practice'}>
        <div hidden={practiceView !== 'trainer'} className="view game">
          <TrainerPage key={players} solution={solution} solvedSpot={solvedSpot} onOpenAnalyze={openAnalyze} />
        </div>
        <div hidden={practiceView !== 'drill'} className="view scroll">
          <RangeDrillPage key={players} solution={solution} />
        </div>
        <div hidden={practiceView !== 'review'} className="view scroll">
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
        <div className="view game">
          <LearnPage />
        </div>
      </main>
    </div>
  )
}
