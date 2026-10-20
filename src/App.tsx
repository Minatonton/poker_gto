import { useMemo, useState } from 'react'
import { ActionPath } from './components/ActionPath'
import { RangeGrid } from './components/RangeGrid'
import { StrategyPanel } from './components/StrategyPanel'
import { cash6max100bb } from './data/cash6max100bb'
import type { HandClass } from './poker/hands'
import { walkPreflop } from './poker/preflop'
import type { ActionKind } from './poker/strategy'

export default function App() {
  const [choices, setChoices] = useState<ActionKind[]>([])
  const [hoveredHand, setHoveredHand] = useState<HandClass | null>(null)
  const [focusedAction, setFocusedAction] = useState<number | null>(null)

  const walk = useMemo(() => walkPreflop(cash6max100bb, choices), [choices])

  const updateChoices = (next: ActionKind[]) => {
    setChoices(next)
    setFocusedAction(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Poker GTO</h1>
        <span className="game-label">{cash6max100bb.name} / Preflop</span>
        <span className="data-note">近似レンジ（ソルバー出力ではありません）</span>
      </header>

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
        <main className="finished">
          <p>{walk.result}</p>
          <button onClick={() => updateChoices(choices.slice(0, -1))}>1つ戻る</button>
          <button onClick={() => updateChoices([])}>最初から</button>
        </main>
      )}
    </div>
  )
}
