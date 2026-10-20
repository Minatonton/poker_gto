import { useState } from 'react'
import { ScenarioPicker } from '../../components/ScenarioPicker'
import { StudyView } from '../../components/StudyView'
import { ActionBar } from '../../components/table/ActionBar'
import { AdvicePanel } from '../../components/table/AdvicePanel'
import { CardSelect } from '../../components/table/CardSelect'
import { HandHistory } from '../../components/table/HandHistory'
import { PokerTable } from '../../components/table/PokerTable'
import { preflopSeats } from '../../components/table/preflopSeats'
import { heroHandFor, type Hero, type HeroInput } from '../../poker/hero'
import { coachForSeat, preflopHistory } from './handHelpers'
import type { Position, PreflopSolution, Walk } from '../../poker/preflop'
import type { PreflopLine } from '../../poker/preflopLine'
import { overallFrequencies, type ActionKind } from '../../poker/strategy'
import { TableLayout } from './TableLayout'

export interface PreflopHandProps {
  solution: PreflopSolution
  walk: Walk
  choices: ActionKind[]
  line: PreflopLine
  onLine: (line: PreflopLine) => void
  onNavigate: (choices: ActionKind[]) => void
  heroInput: HeroInput
  hero: Hero
  onHeroInput: (input: HeroInput) => void
  onRecord: () => void
}

export function PreflopHand(props: PreflopHandProps) {
  const { solution, walk, choices, line, onLine, onNavigate, heroInput, hero, onHeroInput, onRecord } = props
  const [picking, setPicking] = useState(false)
  const [hidden, setHidden] = useState(false)

  const actor = walk.status === 'deciding' ? walk.position : null
  const heroHand = actor ? heroHandFor(hero, actor) : null
  const { seats, pot } = preflopSeats(walk.steps, walk.positions, actor, hero.position, hero.cards)

  const sit = (position: Position) =>
    onHeroInput({ ...heroInput, position: heroInput.position === position ? null : position })

  const seatHint = coachForSeat(hero)
  const coach =
    walk.status === 'deciding' ? (
      <>
        {actor === hero.position ? (
          <>
            <strong>あなたの番です。</strong>右の「GTO の答え」と比べながら、実際に選んだアクションを入れてください。
          </>
        ) : (
          <>
            <strong>{actor} の番です。</strong>実際に起きたアクションを下のボタンで選んでください。
          </>
        )}
        {seatHint && <span className="coach-hint">{seatHint}</span>}
      </>
    ) : (
      <strong>{walk.result}</strong>
    )

  return (
    <TableLayout
      coach={coach}
      table={
        <PokerTable
          seats={seats}
          pot={pot}
          onSeatClick={sit}
          onHeroCardsClick={() => setPicking(true)}
          overlay={
            picking && (
              <CardSelect
                title="あなたの手札を2枚選んでください"
                count={2}
                initial={hero.cards ?? []}
                onDone={(cards) => {
                  onHeroInput({ ...heroInput, cardsText: cards.join('') })
                  setPicking(false)
                }}
                onCancel={() => setPicking(false)}
              />
            )
          }
        />
      }
      controls={
        walk.status === 'deciding' ? (
          <ActionBar
            actions={walk.strategy.actions}
            disabled={picking}
            onChoose={(index) => onNavigate([...choices, walk.strategy.actions[index].kind])}
          />
        ) : (
          <div className="finished-actions">
            <button className="btn" onClick={() => onNavigate(choices.slice(0, -1))}>
              1つ戻る
            </button>
            <button className="btn" onClick={() => onNavigate([])}>
              最初から
            </button>
          </div>
        )
      }
      side={
        <>
          {walk.status === 'deciding' && (
            <AdvicePanel
              actor={walk.position}
              actions={walk.strategy.actions}
              rangeFrequencies={overallFrequencies(walk.strategy)}
              hand={
                heroHand
                  ? { label: heroHand, frequencies: walk.strategy.frequencies.get(heroHand) ?? [] }
                  : undefined
              }
              hidden={hidden}
              onToggleHidden={() => setHidden(!hidden)}
            />
          )}
          <HandHistory
            entries={preflopHistory(walk, choices, onNavigate)}
            footer={
              <div className="finished-actions">
                <button className="btn small-btn" onClick={onRecord}>
                  このハンドを記録する
                </button>
                <button className="btn small-btn" onClick={() => onNavigate([])} disabled={choices.length === 0}>
                  最初からやり直す
                </button>
              </div>
            }
          />
          <details className="card shortcut">
            <summary className="card-header">シチュエーションを一気に選ぶ</summary>
            <ScenarioPicker solution={solution} line={line} onChange={onLine} />
          </details>
        </>
      }
      below={
        walk.status === 'deciding' && (
          <section className="detail-section">
            <h2 className="detail-heading">{walk.position} のレンジ全体の戦略</h2>
            <StudyView key={`${choices.join()}-${heroHand}`} strategy={walk.strategy} heroHand={heroHand} />
          </section>
        )
      }
    />
  )
}
