import { POSITIONS, type Position } from '../poker/preflop'
import type { Hero, HeroInput } from '../poker/hero'
import { BoardCards } from './postflop/Cards'
import { Segmented } from './Segmented'

interface Props {
  input: HeroInput
  hero: Hero
  onChange: (input: HeroInput) => void
}

export function HeroPanel({ input, hero, onChange }: Props) {
  return (
    <section className="card">
      <header className="card-header">
        自分
        <button
          type="button"
          className="btn small-btn aside-btn"
          onClick={() => onChange({ position: null, cardsText: '' })}
        >
          クリア
        </button>
      </header>
      <div className="card-body scenario">
        <Segmented<Position>
          label="席"
          options={POSITIONS.map((p) => ({ value: p, label: p }))}
          value={input.position ?? undefined}
          onChange={(position) => onChange({ ...input, position })}
        />
        <div className="segmented-row">
          <span className="segmented-label">手札</span>
          <div className="hero-cards">
            <input
              value={input.cardsText}
              onChange={(e) => onChange({ ...input, cardsText: e.target.value })}
              placeholder="例: AhKh"
              aria-label="手札"
            />
            {hero.cards && <BoardCards cards={hero.cards} />}
          </div>
        </div>
        {hero.error && <p className="error small">{hero.error}</p>}
        {!hero.error && hero.cards && !hero.position && <p className="muted small">席を選ぶと、自分の手番でこのハンドを強調します</p>}
      </div>
    </section>
  )
}
