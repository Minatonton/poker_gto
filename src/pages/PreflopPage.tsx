import { ActionPath } from '../components/ActionPath'
import { HeroPanel } from '../components/HeroPanel'
import { ScenarioPicker } from '../components/ScenarioPicker'
import { StudyView } from '../components/StudyView'
import { cash6max100bb } from '../data/cash6max100bb'
import { heroHandFor, type Hero, type HeroInput } from '../poker/hero'
import { spotFromWalk, type PostflopSpot } from '../poker/postflopSpot'
import type { Walk } from '../poker/preflop'
import type { PreflopLine } from '../poker/preflopLine'
import type { ActionKind } from '../poker/strategy'

interface Props {
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
  const spotAtFlop = spotFromWalk(walk)
  const heroHand = walk.status === 'deciding' ? heroHandFor(hero, walk.position) : null

  return (
    <>
      <div className="page-header">
        <h1>プリフロップ</h1>
        <span className="caption">一般的なレンジをもとにした近似値です。ソルバーの出力ではありません。</span>
      </div>

      <div className="setup-row">
        <ScenarioPicker solution={cash6max100bb} line={line} onChange={onLine} />
        <HeroPanel input={heroInput} hero={hero} onChange={onHeroInput} />
      </div>

      <section className="card">
        <ActionPath
          walk={walk}
          onRewind={(count) => onNavigate(choices.slice(0, count))}
          onChoose={(kind) => onNavigate([...choices, kind])}
        />
      </section>

      {walk.status === 'deciding' ? (
        <StudyView key={`${choices.join()}-${heroHand}`} strategy={walk.strategy} heroHand={heroHand} />
      ) : (
        <section className="card empty-state">
          <p>{walk.result}</p>
          <div className="finished-actions">
            {spotAtFlop && (
              <button className="btn primary" onClick={() => onSolveSpot(spotAtFlop)}>
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
        </section>
      )}
    </>
  )
}
