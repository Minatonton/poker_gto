import { useState } from 'react'
import { displayBoard, parseBoard, randomFlop } from '../../poker/cards'
import type { PostflopSpot } from '../../poker/postflopSpot'
import { spotConfig, type Street, type StreetSizeOptions } from '../../solver/spotConfig'
import { CHIPS_PER_BB, type SolveOptions, type SpotConfig } from '../../solver/types'
import { BoardCards } from './Cards'

/**
 * ベットサイズを1つ増やすごとに後続のツリーが掛け算で増える。
 * 全ストリート2サイズにすると SRP でも10GiB を超え、ソルブに数十分かかるため、ターン以降は1サイズにしている。
 */
const DEFAULT_SIZES: StreetSizeOptions = {
  flop: { bet: '33%, 75%', raise: '3x' },
  turn: { bet: '75%', raise: '3x' },
  river: { bet: '75%', raise: '3x' },
}

const STREET_LABELS: Record<Street, string> = { flop: 'フロップ', turn: 'ターン', river: 'リバー' }

interface Props {
  spot: PostflopSpot
  /** ランダムなボードに自分の手札が出ないようにする */
  heroCards: [string, string] | null
  disabled: boolean
  onSolve: (config: SpotConfig, options: SolveOptions) => void
}

export function SolveSettings({ spot, heroCards, disabled, onSolve }: Props) {
  const drawFlop = () => randomFlop(heroCards ?? []).join(' ')
  const [boardText, setBoardText] = useState(drawFlop)
  const [sizes, setSizes] = useState(DEFAULT_SIZES)
  const [maxIterations, setMaxIterations] = useState(1000)
  const [targetPercent, setTargetPercent] = useState(0.5)

  let board: string[] | null = null
  let boardError = ''
  try {
    board = parseBoard(boardText)
  } catch (error) {
    boardError = (error as Error).message
  }

  const submit = () => {
    if (!board) return
    const startingPot = Math.round(spot.potBb * CHIPS_PER_BB)
    onSolve(spotConfig(spot, board.join(''), sizes), {
      maxIterations,
      targetExploitability: (startingPot * targetPercent) / 100,
    })
  }

  return (
    <section className="card">
      <header className="card-header">ソルブ条件</header>
      <dl className="spot-facts">
        <div>
          <dt>ポジション</dt>
          <dd>
            {spot.oop} / {spot.ip}
          </dd>
        </div>
        <div>
          <dt>ポット</dt>
          <dd className="num">{spot.potBb}bb</dd>
        </div>
        <div>
          <dt>有効スタック</dt>
          <dd className="num">{spot.effectiveStackBb}bb</dd>
        </div>
      </dl>

      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label className="field">
          <span>ボード</span>
          <div className="board-input">
            <input value={boardText} onChange={(e) => setBoardText(e.target.value)} placeholder="例: As Kd 7c" />
            <button type="button" className="btn" onClick={() => setBoardText(drawFlop())}>
              ランダム
            </button>
          </div>
        </label>
        <div className="board-preview">
          {board ? <BoardCards cards={displayBoard(board)} /> : <span className="error small">{boardError}</span>}
        </div>

        <div className="field">
          <span>ベットサイズ（ベットはポット比 % とオールイン a、レイズは前のベットの倍率 x）</span>
          <div className="size-grid">
            <span />
            <span className="head">ベット</span>
            <span className="head">レイズ</span>
            {(Object.keys(STREET_LABELS) as Street[]).map((street) => (
              <SizeRow
                key={street}
                label={STREET_LABELS[street]}
                value={sizes[street]}
                onChange={(value) => setSizes({ ...sizes, [street]: value })}
              />
            ))}
          </div>
        </div>

        <div className="field-pair">
          <label className="field">
            <span>最大反復回数</span>
            <input
              type="number"
              min={10}
              value={maxIterations}
              onChange={(e) => setMaxIterations(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>目標精度（ポット比 %）</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={targetPercent}
              onChange={(e) => setTargetPercent(Number(e.target.value))}
            />
          </label>
        </div>

        <button type="submit" className="btn primary large" disabled={disabled || !board}>
          ソルブする
        </button>
      </form>
    </section>
  )
}

function SizeRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: { bet: string; raise: string }
  onChange: (value: { bet: string; raise: string }) => void
}) {
  return (
    <>
      <span>{label}</span>
      <input aria-label={`${label}のベット`} value={value.bet} onChange={(e) => onChange({ ...value, bet: e.target.value })} />
      <input
        aria-label={`${label}のレイズ`}
        value={value.raise}
        onChange={(e) => onChange({ ...value, raise: e.target.value })}
      />
    </>
  )
}
