import { useState } from 'react'
import { parseBoard, randomFlop } from '../../poker/cards'
import type { PostflopSpot } from '../../poker/postflopSpot'
import { toRangeNotation } from '../../poker/postflopSpot'
import { CHIPS_PER_BB, type SolveOptions, type SpotConfig, type StreetSizes } from '../../solver/types'
import { BoardCards } from './Cards'

type Street = 'flop' | 'turn' | 'river'

/**
 * ベットサイズを1つ増やすごとに後続のツリーが掛け算で増える。
 * 全ストリート2サイズにすると SRP でも10GiB を超え、ソルブに数十分かかるため、ターン以降は1サイズにしている。
 */
const DEFAULT_SIZES: Record<Street, { bet: string; raise: string }> = {
  flop: { bet: '33%, 75%', raise: '3x' },
  turn: { bet: '75%', raise: '3x' },
  river: { bet: '75%', raise: '3x' },
}

const STREET_LABELS: Record<Street, string> = { flop: 'フロップ', turn: 'ターン', river: 'リバー' }

interface Props {
  spot: PostflopSpot
  disabled: boolean
  onSolve: (config: SpotConfig, options: SolveOptions) => void
}

export function SolveSettings({ spot, disabled, onSolve }: Props) {
  const [boardText, setBoardText] = useState(() => randomFlop().join(' '))
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
    const sameForBoth = (street: Street): StreetSizes => ({ oop: sizes[street], ip: sizes[street] })
    onSolve(
      {
        oopRange: toRangeNotation(spot.oopRange),
        ipRange: toRangeNotation(spot.ipRange),
        board: board.join(''),
        startingPot,
        effectiveStack: Math.round(spot.effectiveStackBb * CHIPS_PER_BB),
        rakeRate: 0,
        rakeCap: 0,
        flop: sameForBoth('flop'),
        turn: sameForBoth('turn'),
        river: sameForBoth('river'),
        addAllinThreshold: 1.5,
        forceAllinThreshold: 0.15,
      },
      { maxIterations, targetExploitability: (startingPot * targetPercent) / 100 },
    )
  }

  return (
    <section className="panel solve-settings">
      <h2>{spot.name}</h2>
      <p className="hint">
        ポット {spot.potBb}bb / 有効スタック {spot.effectiveStackBb}bb / OOP: {spot.oop}, IP: {spot.ip}
      </p>

      <label className="field">
        <span>ボード</span>
        <input value={boardText} onChange={(e) => setBoardText(e.target.value)} placeholder="As Kd 7c" />
        <button type="button" onClick={() => setBoardText(randomFlop().join(' '))}>
          ランダム
        </button>
        {board ? <BoardCards cards={board} /> : <span className="error">{boardError}</span>}
      </label>

      <table className="size-table">
        <thead>
          <tr>
            <th />
            <th>ベット（ポット比 % / オールイン a）</th>
            <th>レイズ（前のベットの倍率 x）</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(STREET_LABELS) as Street[]).map((street) => (
            <tr key={street}>
              <th>{STREET_LABELS[street]}</th>
              {(['bet', 'raise'] as const).map((field) => (
                <td key={field}>
                  <input
                    value={sizes[street][field]}
                    onChange={(e) =>
                      setSizes({ ...sizes, [street]: { ...sizes[street], [field]: e.target.value } })
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="field-row">
        <label className="field">
          <span>最大反復回数</span>
          <input type="number" min={10} value={maxIterations} onChange={(e) => setMaxIterations(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>目標 exploitability（ポット比 %）</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={targetPercent}
            onChange={(e) => setTargetPercent(Number(e.target.value))}
          />
        </label>
      </div>

      <button className="primary" disabled={disabled || !board} onClick={submit}>
        ソルブ開始
      </button>
    </section>
  )
}
