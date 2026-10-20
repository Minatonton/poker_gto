import { useMemo, useState } from 'react'
import { NAV, type Page } from './app/navigation'
import { PostflopView } from './components/postflop/PostflopView'
import { cashSolution, MAX_PLAYERS, MIN_PLAYERS } from './data/cashSolutions'
import { CalculatorsPage } from './pages/CalculatorsPage'
import { PreflopPage } from './pages/PreflopPage'
import { RangeDrillPage } from './pages/RangeDrillPage'
import { TrainerPage } from './pages/TrainerPage'
import { parseHero, type HeroInput } from './poker/hero'
import type { PostflopSpot } from './poker/postflopSpot'
import { walkPreflop } from './poker/preflop'
import { choicesForLine, lineOfWalk, type PreflopLine } from './poker/preflopLine'
import type { ActionKind } from './poker/strategy'

const PLAYER_COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i)

export default function App() {
  const [page, setPage] = useState<Page>('preflop')
  const [players, setPlayers] = useState(6)
  const solution = useMemo(() => cashSolution(players), [players])
  const [choices, setChoices] = useState<ActionKind[]>([])
  const [postflopSpot, setPostflopSpot] = useState<{ id: number; spot: PostflopSpot } | null>(null)
  const [heroInput, setHeroInput] = useState<HeroInput>({ position: null, cardsText: '' })
  // 「応じた人」だけを選んでアクションが未定のときは、辿ったラインからは選択を読み戻せないため、
  // 選択欄で選んだ内容を別に持つ。アクションラインで直接進めたら、辿ったラインの表示に戻す
  const [pickedLine, setPickedLine] = useState<PreflopLine | null>(null)
  const [solvedSpot, setSolvedSpot] = useState<PostflopSpot | null>(null)

  const walk = useMemo(() => walkPreflop(solution, choices), [solution, choices])
  const line = useMemo(() => pickedLine ?? lineOfWalk(walk), [pickedLine, walk])
  const hero = useMemo(() => parseHero(heroInput), [heroInput])

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

  const solveSpot = (spot: PostflopSpot) => {
    setPostflopSpot((current) => ({ id: (current?.id ?? 0) + 1, spot }))
    setPage('postflop')
  }

  return (
    <>
      <header className="app-header">
        <span className="brand">Poker GTO</span>
        <label className="players-select">
          人数
          <select value={players} onChange={(e) => changePlayers(Number(e.target.value))}>
            {PLAYER_COUNTS.map((n) => (
              <option key={n} value={n}>
                {n === 2 ? 'ヘッズアップ（2人）' : `${n}人`}
              </option>
            ))}
          </select>
        </label>
        <span className="game-chip">{solution.name}</span>
      </header>

      <div className="app-body">
        <nav className="side-nav">
          {NAV.map((item) => (
            <button
              key={item.page}
              className="nav-item"
              aria-current={page === item.page ? 'page' : undefined}
              onClick={() => setPage(item.page)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <main className="page" hidden={page !== 'preflop'}>
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
          />
        </main>

        {/* ソルブ結果を保つため、ページを切り替えてもポストフロップ画面はアンマウントしない */}
        <main className="page" hidden={page !== 'postflop'}>
          <div className="page-header">
            <h1>ポストフロップ</h1>
            {postflopSpot && <span className="caption">{postflopSpot.spot.name}</span>}
          </div>
          {postflopSpot ? (
            <PostflopView
              key={postflopSpot.id}
              spot={postflopSpot.spot}
              hero={hero}
              onSolved={() => setSolvedSpot(postflopSpot.spot)}
            />
          ) : (
            <section className="card empty-state">
              <p>プリフロップでフロップまで進むラインを選ぶと、そのスポットをここでソルブできます。</p>
              <button className="btn primary" onClick={() => setPage('preflop')}>
                プリフロップでラインを選ぶ
              </button>
            </section>
          )}
        </main>

        <main className="page" hidden={page !== 'trainer'}>
          <TrainerPage key={players} solution={solution} solvedSpot={solvedSpot} onOpenPostflop={() => setPage('postflop')} />
        </main>

        <main className="page" hidden={page !== 'drill'}>
          <RangeDrillPage key={players} solution={solution} />
        </main>

        <main className="page" hidden={page !== 'calculators'}>
          <CalculatorsPage hero={hero} />
        </main>
      </div>
    </>
  )
}
