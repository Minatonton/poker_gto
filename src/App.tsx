import { useMemo, useState } from 'react'
import { NAV, type Page } from './app/navigation'
import { PostflopView } from './components/postflop/PostflopView'
import { cash6max100bb } from './data/cash6max100bb'
import { CalculatorsPage } from './pages/CalculatorsPage'
import { PreflopPage } from './pages/PreflopPage'
import { TrainerPage } from './pages/TrainerPage'
import { parseHero, type HeroInput } from './poker/hero'
import type { PostflopSpot } from './poker/postflopSpot'
import { walkPreflop } from './poker/preflop'
import { choicesForLine, lineOfWalk, type PreflopLine } from './poker/preflopLine'
import type { ActionKind } from './poker/strategy'

export default function App() {
  const [page, setPage] = useState<Page>('preflop')
  const [choices, setChoices] = useState<ActionKind[]>([])
  const [postflopSpot, setPostflopSpot] = useState<{ id: number; spot: PostflopSpot } | null>(null)
  const [heroInput, setHeroInput] = useState<HeroInput>({ position: null, cardsText: '' })
  // 「応じた人」だけを選んでアクションが未定のときは、辿ったラインからは選択を読み戻せないため、
  // 選択欄で選んだ内容を別に持つ。アクションラインで直接進めたら、辿ったラインの表示に戻す
  const [pickedLine, setPickedLine] = useState<PreflopLine | null>(null)
  const [solvedSpot, setSolvedSpot] = useState<PostflopSpot | null>(null)

  const walk = useMemo(() => walkPreflop(cash6max100bb, choices), [choices])
  const line = useMemo(() => pickedLine ?? lineOfWalk(walk), [pickedLine, walk])
  const hero = useMemo(() => parseHero(heroInput), [heroInput])

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
        <span className="game-chip">{cash6max100bb.name}</span>
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
            walk={walk}
            choices={choices}
            line={line}
            onLine={(next) => {
              setPickedLine(next)
              setChoices(choicesForLine(cash6max100bb, next))
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
          <TrainerPage solvedSpot={solvedSpot} onOpenPostflop={() => setPage('postflop')} />
        </main>

        <main className="page" hidden={page !== 'calculators'}>
          <CalculatorsPage hero={hero} />
        </main>
      </div>
    </>
  )
}
