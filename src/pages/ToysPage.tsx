import { useState } from 'react'
import { formatPercent } from '../components/actionColors'
import {
  akqBestResponses,
  akqBettorEv,
  akqEquilibrium,
  HANDS,
  rpsBestResponse,
  rpsEv,
  rpsEvs,
  type Hand,
  type Mix,
} from '../toys/games'

/** Amu 氏の note「GTOとは何か」「ポラライズ」「Geometric Betsize」で使われるトイゲームを触って確かめる */
export function ToysPage() {
  return (
    <>
      <div className="page-header">
        <h1>トイゲーム</h1>
        <span className="caption">単純なゲームで、GTO・搾取・ポラライズしたベットの考え方を数字で確かめます。</span>
      </div>
      <div className="calc-grid toys">
        <RockPaperScissors />
        <AkqGame />
      </div>
    </>
  )
}

const percentInput = (value: number, onChange: (v: number) => void, label: string) => (
  <label className="field">
    <span>{label}</span>
    <span className="number-input">
      <input
        type="number"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <span className="muted small">%</span>
    </span>
  </label>
)

/** 合計が100%になるように、変えた手以外を比率を保ったまま縮める */
function setShare(mix: Mix, hand: Hand, value: number): Mix {
  const clamped = Math.min(1, Math.max(0, value))
  const others = HANDS.map((h) => h.hand).filter((h) => h !== hand)
  const rest = others.reduce((sum, h) => sum + mix[h], 0)
  const next = { ...mix, [hand]: clamped }
  for (const h of others) next[h] = rest === 0 ? (1 - clamped) / others.length : (mix[h] / rest) * (1 - clamped)
  return next
}

function RockPaperScissors() {
  const [opponent, setOpponent] = useState<Mix>({ rock: 0.4, paper: 0.3, scissors: 0.3 })
  const [mine, setMine] = useState<Mix>({ rock: 1 / 3, paper: 1 / 3, scissors: 1 / 3 })
  const evs = rpsEvs(opponent)
  const best = rpsBestResponse(opponent)
  const label = (hand: Hand) => HANDS.find((h) => h.hand === hand)!.label

  return (
    <section className="card">
      <header className="card-header">じゃんけん（GTO と搾取）</header>
      <div className="card-body calc-body">
        <p className="muted small">相手の出し方の偏りを変えて、自分の各手の EV と、最も得をする手を見ます。</p>
        <div className="field-triple">
          {HANDS.map(({ hand, label: name }) => (
            <span key={hand}>
              {percentInput(opponent[hand], (v) => setOpponent(setShare(opponent, hand, v)), `相手の${name}`)}
            </span>
          ))}
        </div>
        <table className="plain-table">
          <thead>
            <tr>
              <th>自分が出し続ける手</th>
              <th className="num">EV（1回あたり）</th>
            </tr>
          </thead>
          <tbody>
            {HANDS.map(({ hand, label: name }) => (
              <tr key={hand} className={hand === best ? 'highlight-row' : ''}>
                <td>
                  {name}
                  {hand === best && <span className="muted small">（最大搾取）</span>}
                </td>
                <td className="num">{evs[hand].toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="field-triple">
          {HANDS.map(({ hand, label: name }) => (
            <span key={hand}>{percentInput(mine[hand], (v) => setMine(setShare(mine, hand, v)), `自分の${name}`)}</span>
          ))}
        </div>
        <dl className="calc-results">
          <div>
            <dt>自分の混合戦略の EV</dt>
            <dd className="num">{rpsEv(mine, opponent).toFixed(3)}</dd>
          </div>
        </dl>
        <p className="verdict good">
          均等（各 33%）に出す GTO は、相手がどう偏っても EV 0 で、搾取されません。相手が偏っているなら{label(best)}
          を増やすと得をしますが、 その分だけ自分も偏り、相手に読まれると逆に搾取されます。
        </p>
      </div>
    </section>
  )
}

const GRAPH = { width: 520, height: 200, padding: 36 }
const MAX_BET = 4

function AkqGame() {
  const [pot, setPot] = useState(1)
  const [bet, setBet] = useState(1)
  const eq = akqEquilibrium(pot, bet)
  const [bluff, setBluff] = useState(eq.bluffFrequency)
  const [call, setCall] = useState(eq.callFrequency)
  const responses = akqBestResponses(pot, bet, bluff, call)
  const ev = akqBettorEv(pot, bet, bluff, call)

  const points = Array.from({ length: 40 }, (_, i) => {
    const size = ((i + 1) / 40) * MAX_BET
    return { size, ev: akqEquilibrium(1, size).bettorEv }
  })
  const x = (size: number) => GRAPH.padding + (size / MAX_BET) * (GRAPH.width - GRAPH.padding * 1.5)
  const y = (value: number) =>
    GRAPH.height - GRAPH.padding - ((value - 0.5) / 0.5) * (GRAPH.height - GRAPH.padding * 1.5)

  const resetToEquilibrium = (nextPot = pot, nextBet = bet) => {
    const next = akqEquilibrium(nextPot, nextBet)
    setBluff(next.bluffFrequency)
    setCall(next.callFrequency)
  }

  return (
    <section className="card calc-wide">
      <header className="card-header">AKQ ゲーム（ポラライズしたベット）</header>
      <div className="card-body akq">
        <div className="calc-body">
          <p className="muted small">
            リバーで、打つ側は A（必ず勝つ）か Q（必ず負ける）を半々で持ち、受ける側は K だけを持ちます。打つ側は A
            で必ずベットし、Q でブラフする頻度を選びます。受ける側は K でコールする頻度を選びます。
          </p>
          <div className="field-pair">
            <label className="field">
              <span>ポット</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={pot}
                onChange={(e) => {
                  setPot(Number(e.target.value))
                  resetToEquilibrium(Number(e.target.value), bet)
                }}
              />
            </label>
            <label className="field">
              <span>ベット</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={bet}
                onChange={(e) => {
                  setBet(Number(e.target.value))
                  resetToEquilibrium(pot, Number(e.target.value))
                }}
              />
            </label>
          </div>
          <dl className="calc-results">
            <div>
              <dt>均衡のブラフ頻度（Q のうち）</dt>
              <dd className="num">{formatPercent(eq.bluffFrequency)}</dd>
              <p className="muted small">ベット ÷ (ポット + ベット)。受ける側のコールとフォールドの EV を等しくする</p>
            </div>
            <div>
              <dt>均衡のコール頻度（MDF）</dt>
              <dd className="num">{formatPercent(eq.callFrequency)}</dd>
              <p className="muted small">ポット ÷ (ポット + ベット)。打つ側の Q のブラフとチェックの EV を等しくする</p>
            </div>
            <div>
              <dt>均衡での打つ側の EV</dt>
              <dd className="num">ポットの {formatPercent(eq.bettorEv / pot)}</dd>
            </div>
          </dl>
          <div className="field-pair">
            {percentInput(bluff, setBluff, 'Q でブラフする頻度')}
            {percentInput(call, setCall, 'K でコールする頻度')}
          </div>
          <dl className="calc-results">
            <div>
              <dt>この頻度での打つ側の EV</dt>
              <dd className="num">ポットの {formatPercent(ev / pot)}</dd>
            </div>
            <div>
              <dt>受ける側の最善の対応</dt>
              <dd>{responses.caller}</dd>
            </div>
            <div>
              <dt>打つ側の最善の対応</dt>
              <dd>{responses.bettor}</dd>
            </div>
          </dl>
          <button className="btn" onClick={() => resetToEquilibrium()}>
            均衡の頻度に戻す
          </button>
        </div>
        <div>
          <svg
            className="equity-graph"
            viewBox={`0 0 ${GRAPH.width} ${GRAPH.height}`}
            role="img"
            aria-label="ベットサイズと打つ側の EV"
          >
            {[0.5, 0.75, 1].map((tick) => (
              <g key={tick}>
                <line
                  className="grid-line"
                  x1={GRAPH.padding}
                  x2={GRAPH.width - GRAPH.padding / 2}
                  y1={y(tick)}
                  y2={y(tick)}
                />
                <text className="tick" x={GRAPH.padding - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                  {tick * 100}%
                </text>
              </g>
            ))}
            {[1, 2, 3, 4].map((size) => (
              <text key={size} className="tick" x={x(size)} y={GRAPH.height - 10} textAnchor="middle">
                {size}x
              </text>
            ))}
            <path
              className="curve solid"
              d={points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.size).toFixed(1)},${y(p.ev).toFixed(1)}`).join('')}
            />
            <circle cx={x(Math.min(bet / pot, MAX_BET))} cy={y(eq.bettorEv / pot)} r={5} className="graph-point" />
          </svg>
          <p className="panel-note">
            横軸はポットに対するベットの大きさ、縦軸は均衡での打つ側の
            EV（ポット比）。ベットを大きくするほどブラフを多く混ぜられ、EV が上がります。
            二極化したレンジで複数のストリートがあるときは、毎回同じ比率で打ってオールインに届くジオメトリックサイズが基準になります（計算機を参照）。
          </p>
        </div>
      </div>
    </section>
  )
}
