import { useMemo, useState } from 'react'
import { ActionPath } from './components/ActionPath'
import { PostflopView } from './components/postflop/PostflopView'
import { StudyView } from './components/StudyView'
import { cash6max100bb } from './data/cash6max100bb'
import { spotFromWalk, type PostflopSpot } from './poker/postflopSpot'
import { walkPreflop } from './poker/preflop'
import type { ActionKind } from './poker/strategy'

type Page = 'preflop' | 'postflop'

const NAV: { page: Page; label: string; icon: React.ReactNode }[] = [
  {
    page: 'preflop',
    label: 'プリフロップ',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2.5" y="2.5" width="13" height="13" rx="1.5" />
        <path d="M2.5 7h13M2.5 11h13M7 2.5v13M11 2.5v13" />
      </svg>
    ),
  },
  {
    page: 'postflop',
    label: 'ポストフロップ',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1.5" y="4" width="4.5" height="6.5" rx="1" />
        <rect x="6.75" y="4" width="4.5" height="6.5" rx="1" />
        <rect x="12" y="4" width="4.5" height="6.5" rx="1" />
        <path d="M3 14h12" />
      </svg>
    ),
  },
]

export default function App() {
  const [page, setPage] = useState<Page>('preflop')
  const [choices, setChoices] = useState<ActionKind[]>([])
  const [postflopSpot, setPostflopSpot] = useState<{ id: number; spot: PostflopSpot } | null>(null)

  const walk = useMemo(() => walkPreflop(cash6max100bb, choices), [choices])
  const spotAtFlop = useMemo(() => spotFromWalk(walk), [walk])

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

        {/* ソルブ結果を保つため、ページを切り替えてもポストフロップ画面はアンマウントしない */}
        <main className="page" hidden={page !== 'postflop'}>
          <div className="page-header">
            <h1>ポストフロップ</h1>
            {postflopSpot && <span className="caption">{postflopSpot.spot.name}</span>}
          </div>
          {postflopSpot ? (
            <PostflopView key={postflopSpot.id} spot={postflopSpot.spot} />
          ) : (
            <section className="card empty-state">
              <p>プリフロップでフロップまで進むラインを選ぶと、そのスポットをここでソルブできます。</p>
              <button className="btn primary" onClick={() => setPage('preflop')}>
                プリフロップでラインを選ぶ
              </button>
            </section>
          )}
        </main>

        <main className="page" hidden={page !== 'preflop'}>
          <div className="page-header">
            <h1>プリフロップ</h1>
            <span className="caption">一般的なレンジをもとにした近似値です。ソルバーの出力ではありません。</span>
          </div>

          <section className="card">
            <ActionPath
              walk={walk}
              onRewind={(count) => setChoices(choices.slice(0, count))}
              onChoose={(kind) => setChoices([...choices, kind])}
            />
          </section>

          {walk.status === 'deciding' ? (
            <StudyView key={choices.length} strategy={walk.strategy} />
          ) : (
            <section className="card empty-state">
              <p>{walk.result}</p>
              <div className="finished-actions">
                {spotAtFlop && (
                  <button className="btn primary" onClick={() => solveSpot(spotAtFlop)}>
                    このスポットをソルブする
                  </button>
                )}
                <button className="btn" onClick={() => setChoices(choices.slice(0, -1))}>
                  1つ戻る
                </button>
                <button className="btn" onClick={() => setChoices([])}>
                  最初から
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  )
}
