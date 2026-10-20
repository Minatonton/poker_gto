import { useState } from 'react'
import { actionColor } from '../components/actionColors'
import { ScenarioPicker } from '../components/ScenarioPicker'
import { StudyView } from '../components/StudyView'
import { ActionBar } from '../components/table/ActionBar'
import { HandHistory, type HistoryEntry } from '../components/table/HandHistory'
import { HoleCardPicker } from '../components/table/HoleCardPicker'
import { PokerTable } from '../components/table/PokerTable'
import { preflopSeats } from '../components/table/preflopSeats'
import { BoardCards } from '../components/postflop/Cards'
import { heroHandFor, type Hero, type HeroInput } from '../poker/hero'
import { spotFromWalk, type PostflopSpot } from '../poker/postflopSpot'
import type { Position, PreflopSolution, Walk } from '../poker/preflop'
import type { PreflopLine } from '../poker/preflopLine'
import type { ActionKind } from '../poker/strategy'

interface Props {
  solution: PreflopSolution
  walk: Walk
  choices: ActionKind[]
  line: PreflopLine
  onLine: (line: PreflopLine) => void
  onNavigate: (choices: ActionKind[]) => void
  heroInput: HeroInput
  hero: Hero
  onHeroInput: (input: HeroInput) => void
  onSolveSpot: (spot: PostflopSpot) => void
}

export function PreflopPage({
  solution,
  walk,
  choices,
  line,
  onLine,
  onNavigate,
  heroInput,
  hero,
  onHeroInput,
  onSolveSpot,
}: Props) {
  const [showFrequencies, setShowFrequencies] = useState(true)
  const [pickingCards, setPickingCards] = useState(false)

  const spotAtFlop = spotFromWalk(walk)
  const actor = walk.status === 'deciding' ? walk.position : null
  const heroHand = actor ? heroHandFor(hero, actor) : null
  const { seats, pot } = preflopSeats(walk.steps, walk.positions, actor, hero.position, hero.cards)

  let choiceCount = 0
  const history: HistoryEntry[] = walk.steps.map((step) => {
    const rewindTo = choiceCount
    const auto = step.strategy === null
    if (!auto) choiceCount++
    return {
      actor: step.position,
      label: auto ? 'Fold（データなし）' : step.action.label,
      color: actionColor(step.action),
      disabled: auto,
      onRewind: () => onNavigate(choices.slice(0, rewindTo)),
    }
  })

  const toggleSeat = (position: Position) =>
    onHeroInput({ ...heroInput, position: heroInput.position === position ? null : position })

  return (
    <>
      <div className="page-header">
        <h1>プリフロップ</h1>
        <span className="caption">一般的なレンジをもとにした近似値です。ソルバーの出力ではありません。</span>
      </div>

      <div className="table-layout">
        <section className="card table-card">
          <PokerTable seats={seats} pot={pot} onSeatClick={toggleSeat} />
          {walk.status === 'deciding' ? (
            <ActionBar
              actor={walk.position}
              strategy={walk.strategy}
              showFrequencies={showFrequencies}
              onToggleFrequencies={() => setShowFrequencies(!showFrequencies)}
              heroHand={heroHand}
              onChoose={(index) => onNavigate([...choices, walk.strategy.actions[index].kind])}
            />
          ) : (
            <div className="action-bar">
              <div className="action-bar-head">
                <strong>{walk.result}</strong>
              </div>
              <div className="finished-actions">
                {spotAtFlop && (
                  <button className="btn primary large" onClick={() => onSolveSpot(spotAtFlop)}>
                    このスポットをソルブする
                  </button>
                )}
                <button className="btn" onClick={() => onNavigate(choices.slice(0, -1))}>
                  1つ戻る
                </button>
                <button className="btn" onClick={() => onNavigate([])}>
                  最初から
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="table-side">
          <section className="card">
            <header className="card-header">
              自分
              <span className="aside">テーブルの席をクリックすると座れます</span>
            </header>
            <div className="card-body hero-body">
              <div className="hero-summary">
                <span>
                  席 <strong>{hero.position ?? '未選択'}</strong>
                </span>
                {hero.cards ? <BoardCards cards={hero.cards} /> : <span className="muted small">手札は未選択</span>}
                <button type="button" className="btn small-btn" onClick={() => setPickingCards(!pickingCards)}>
                  手札を選ぶ
                </button>
                {(hero.position || hero.cards) && (
                  <button
                    type="button"
                    className="btn small-btn"
                    onClick={() => onHeroInput({ position: null, cardsText: '' })}
                  >
                    クリア
                  </button>
                )}
              </div>
              {pickingCards && (
                <HoleCardPicker
                  initial={hero.cards ?? []}
                  onDone={(cards) => {
                    onHeroInput({ ...heroInput, cardsText: cards.join('') })
                    setPickingCards(false)
                  }}
                  onCancel={() => setPickingCards(false)}
                />
              )}
            </div>
          </section>

          <HandHistory
            entries={history}
            footer={
              <button className="btn small-btn" onClick={() => onNavigate([])} disabled={choices.length === 0}>
                最初からやり直す
              </button>
            }
          />

          <details className="card shortcut">
            <summary className="card-header">シチュエーションを一気に選ぶ</summary>
            <ScenarioPicker solution={solution} line={line} onChange={onLine} />
          </details>
        </div>
      </div>

      {walk.status === 'deciding' && (
        <StudyView key={`${choices.join()}-${heroHand}`} strategy={walk.strategy} heroHand={heroHand} />
      )}
    </>
  )
}
