import type { PostflopSpot } from '../../poker/postflopSpot'
import { equityCurve, toBb, type EquityPoint } from '../../solver/aggregate'
import { rangeShape } from '../../solver/breakdown'
import type { PlayerNode } from '../../solver/types'
import { formatPercent } from '../actionColors'

interface Props {
  spot: PostflopSpot
  node: PlayerNode
}

/** 両者のレンジ全体の EQ・EV・EQR。どちらのレンジが有利かと、EQ をどれだけ実現できているかを比べる */
export function RangeSummaryCard({ spot, node }: Props) {
  const shapeOf = (side: 0 | 1) => rangeShape(node.player === side ? node.hands : node.opponentHands)
  const rows = [
    { position: spot.oop, side: 'OOP', summary: node.ranges[0], acting: node.player === 0, shape: shapeOf(0) },
    { position: spot.ip, side: 'IP', summary: node.ranges[1], acting: node.player === 1, shape: shapeOf(1) },
  ]
  return (
    <section className="card">
      <table className="range-summary">
        <thead>
          <tr>
            <th />
            <th className="num">EQ</th>
            <th className="num">EV</th>
            <th className="num" title="EV ÷ (EQ × ポット)。100%を超えるとEQ以上にポットを取れている">
              EQR
            </th>
            <th className="num">combos</th>
            <th title="EQ 75%以上・中間・25%以下のコンボの割合から判定">レンジの形</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ position, side, summary, acting, shape }) => (
            <tr key={side} className={acting ? 'acting' : ''}>
              <th>
                {position}
                <span className="muted small"> {side}{acting ? '・手番' : ''}</span>
              </th>
              <td className="num">{formatPercent(summary.equity)}</td>
              <td className="num">{toBb(summary.ev).toFixed(2)}bb</td>
              <td className="num">{formatPercent(summary.eqr)}</td>
              <td className="num muted">{summary.combos.toFixed(1)}</td>
              <td>
                {shape.label}
                <span className="muted small">
                  {' '}
                  強 {formatPercent(shape.strong)}・中 {formatPercent(shape.medium)}・弱 {formatPercent(shape.weak)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

const WIDTH = 640
const HEIGHT = 220
const PADDING = { top: 12, right: 16, bottom: 28, left: 40 }

/**
 * 横軸に自分のレンジ内での強さの順位（上位から何割か）、縦軸に EQ を取ったグラフ。
 * 曲線が上にある側のレンジが強く、曲線の傾きが急なほどレンジが二極化（ポラライズ）している
 */
export function EquityGraph({ spot, node }: Props) {
  const acting = equityCurve(node.hands)
  const waiting = equityCurve(node.opponentHands)
  const [oopCurve, ipCurve] = node.player === 0 ? [acting, waiting] : [waiting, acting]
  const innerWidth = WIDTH - PADDING.left - PADDING.right
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom
  const x = (percentile: number) => PADDING.left + percentile * innerWidth
  const y = (equity: number) => PADDING.top + (1 - equity) * innerHeight
  const path = (curve: EquityPoint[]) =>
    curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.percentile).toFixed(1)},${y(p.equity).toFixed(1)}`).join('')

  return (
    <section className="card">
      <header className="card-header">
        EQ グラフ
        <span className="aside legend">
          <span className="legend-line solid" /> {spot.oop}（OOP）
          <span className="legend-line dashed" /> {spot.ip}（IP）
        </span>
      </header>
      <svg className="equity-graph" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="両者のレンジのEQ分布">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line className="grid-line" x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(tick)} y2={y(tick)} />
            <text className="tick" x={PADDING.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">
              {tick * 100}%
            </text>
            <text className="tick" x={x(tick)} y={HEIGHT - 8} textAnchor="middle">
              {tick * 100}%
            </text>
          </g>
        ))}
        <path className="curve solid" d={path(oopCurve)} />
        <path className="curve dashed" d={path(ipCurve)} />
      </svg>
      <p className="panel-note">横軸はレンジ内での強さの順位（左ほど強い）、縦軸は相手のレンジに対する EQ</p>
    </section>
  )
}
