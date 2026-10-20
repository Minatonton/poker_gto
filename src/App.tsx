import { useMemo, useState } from 'react'
import { ActionPath } from './components/ActionPath'
import { PostflopView } from './components/postflop/PostflopView'
import { RangeGrid } from './components/RangeGrid'
import { StrategyPanel } from './components/StrategyPanel'
import { cash6max100bb } from './data/cash6max100bb'
import type { HandClass } from './poker/hands'
import { spotFromWalk, type PostflopSpot } from './poker/postflopSpot'
import { walkPreflop } from './poker/preflop'
import type { ActionKind } from './poker/strategy'

type Tab = 'preflop' | 'postflop'

export default function App() {
  const [tab, setTab] = useState<Tab>('preflop')
  const [choices, setChoices] = useState<ActionKind[]>([])
  const [hoveredHand, setHoveredHand] = useState<HandClass | null>(null)
  const [focusedAction, setFocusedAction] = useState<number | null>(null)
  const [postflopSpot, setPostflopSpot] = useState<{ id: number; spot: PostflopSpot } | null>(null)

  const walk = useMemo(() => walkPreflop(cash6max100bb, choices), [choices])
  const spotAtFlop = useMemo(() => spotFromWalk(walk), [walk])

  const updateChoices = (next: ActionKind[]) => {
    setChoices(next)
    setFocusedAction(null)
  }

  const solveSpot = (spot: PostflopSpot) => {
    setPostflopSpot((current) => ({ id: (current?.id ?? 0) + 1, spot }))
    setTab('postflop')
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Poker GTO</h1>
        <span className="game-label">{cash6max100bb.name}</span>
        <nav className="tabs">
          <button className={tab === 'preflop' ? 'active' : ''} onClick={() => setTab('preflop')}>
            プリフロップ
          </button>
          <button className={tab === 'postflop' ? 'active' : ''} onClick={() => setTab('postflop')}>
            ポストフロップ
          </button>
        </nav>
      </header>

      {/* ソルブ結果を保つため、タブを切り替えてもポストフロップ画面はアンマウントしない */}
      <div hidden={tab !== 'postflop'}>
        {postflopSpot ? (
          <PostflopView key={postflopSpot.id} spot={postflopSpot.spot} />
        ) : (
          <p className="panel">プリフロップでフロップまで進むラインを選び、「このスポットをソルブ」を押してください。</p>
        )}
      </div>

      <div hidden={tab !== 'preflop'}>
        <p className="data-note">プリフロップは近似レンジです（ソルバー出力ではありません）</p>
        <ActionPath
          walk={walk}
          onRewind={(count) => updateChoices(choices.slice(0, count))}
          onChoose={(kind) => updateChoices([...choices, kind])}
        />

        {walk.status === 'deciding' ? (
          <main className="study">
            <RangeGrid strategy={walk.strategy} focusedAction={focusedAction} onHover={setHoveredHand} />
            <StrategyPanel
              strategy={walk.strategy}
              hoveredHand={hoveredHand}
              focusedAction={focusedAction}
              onFocusAction={setFocusedAction}
            />
          </main>
        ) : (
          <main className="panel finished">
            <p>{walk.result}</p>
            {spotAtFlop && (
              <button className="primary" onClick={() => solveSpot(spotAtFlop)}>
                このスポットをソルブ →
              </button>
            )}
            <button onClick={() => updateChoices(choices.slice(0, -1))}>1つ戻る</button>
            <button onClick={() => updateChoices([])}>最初から</button>
          </main>
        )}
      </div>
    </div>
  )
}
