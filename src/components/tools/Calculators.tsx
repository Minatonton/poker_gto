import { useState } from 'react'
import { formatPercent } from '../actionColors'
import { BoardCards } from '../postflop/Cards'
import { RangeGrid } from '../RangeGrid'
import { cardToId, parseCardList, parseHoleCards } from '../../poker/cards'
import { equityVsRange, type EquityResult } from '../../poker/equity'
import type { Hero } from '../../poker/hero'
import {
  bluffRatio,
  geometricBet,
  hitProbability,
  minimumDefenseFrequency,
  odds,
  potPercent,
  requiredEquity,
  requiredEquityAgainstBet,
  ruleOfTwoAndFour,
} from '../../poker/math'
import { parseRange } from '../../poker/range'
import { buildStrategy } from '../../poker/strategy'

function NumberField({
  label,
  value,
  onChange,
  step = 0.5,
  min = 0,
  suffix,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  suffix?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="number-input">
        <input type="number" value={value} step={step} min={min} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix && <span className="muted small">{suffix}</span>}
      </span>
    </label>
  )
}

function Results({ rows }: { rows: { label: string; value: string; note?: string }[] }) {
  return (
    <dl className="calc-results">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd className="num">{row.value}</dd>
          {row.note && <p className="muted small">{row.note}</p>}
        </div>
      ))}
    </dl>
  )
}

const valid = (...values: number[]) => values.every((v) => Number.isFinite(v) && v > 0)

export function BetOddsCard() {
  const [pot, onPot] = useState(22.5)
  const [bet, onBet] = useState(20.25)
  const ok = valid(pot, bet)
  return (
    <section className="card">
      <header className="card-header">ベットを受けたとき</header>
      <div className="card-body calc-body">
        <div className="field-pair">
          <NumberField label="ベット前のポット" value={pot} onChange={onPot} suffix="bb" />
          <NumberField label="相手のベット" value={bet} onChange={onBet} suffix="bb" />
        </div>
        {ok && (
          <Results
            rows={[
              { label: 'ポット比', value: formatPercent(potPercent(pot, bet)) },
              { label: 'オッズ', value: `${odds(pot + bet, bet).toFixed(2)} 倍`, note: '勝ったときに得るチップ ÷ コール額' },
              {
                label: '必要勝率',
                value: formatPercent(requiredEquityAgainstBet(pot, bet)),
                note: 'EQ がこれより高ければ、オールインのコールは +EV',
              },
              {
                label: 'MDF',
                value: formatPercent(minimumDefenseFrequency(pot, bet)),
                note: 'ブラフで得をさせないために、降りずに守る必要があるレンジの割合',
              },
              {
                label: 'ブラフの割合',
                value: formatPercent(bluffRatio(pot, bet)),
                note: 'リバーで打つ側のレンジに混ぜられるブラフの割合',
              },
            ]}
          />
        )}
      </div>
    </section>
  )
}

export function CallOddsCard() {
  const [middle, setMiddle] = useState(14.75)
  const [toCall, setToCall] = useState(8.75)
  const ok = valid(middle, toCall)
  return (
    <section className="card">
      <header className="card-header">レイズ・3ベットにコールするとき</header>
      <div className="card-body calc-body">
        <div className="field-pair">
          <NumberField label="真ん中にあるチップの合計" value={middle} onChange={setMiddle} suffix="bb" />
          <NumberField label="コールに必要な額" value={toCall} onChange={setToCall} suffix="bb" />
        </div>
        {ok && (
          <Results
            rows={[
              { label: 'オッズ', value: `${odds(middle, toCall).toFixed(2)} 倍` },
              { label: '必要勝率', value: formatPercent(requiredEquity(middle, toCall)) },
            ]}
          />
        )}
        <p className="muted small">
          例: HJ が 2.5bb でオープンし、SB が 11.25bb に3ベット。真ん中は 1 + 2.5 + 11.25 = 14.75bb、コールは 8.75bb。
        </p>
      </div>
    </section>
  )
}

export function OutsCard() {
  const [outs, setOuts] = useState(9)
  const [street, setStreet] = useState<'flop' | 'turn'>('flop')
  const cards = street === 'flop' ? 2 : 1
  const unseen = street === 'flop' ? 47 : 46
  return (
    <section className="card">
      <header className="card-header">アウツ</header>
      <div className="card-body calc-body">
        <div className="field-pair">
          <NumberField label="アウツの枚数" value={outs} onChange={setOuts} step={1} />
          <label className="field">
            <span>いまのストリート</span>
            <select value={street} onChange={(e) => setStreet(e.target.value as 'flop' | 'turn')}>
              <option value="flop">フロップ（リバーまで2枚）</option>
              <option value="turn">ターン（リバー1枚）</option>
            </select>
          </label>
        </div>
        {outs >= 0 && outs <= unseen && (
          <Results
            rows={[
              { label: '完成する確率', value: formatPercent(hitProbability(outs, unseen, cards)) },
              {
                label: `${cards === 2 ? '4' : '2'}倍の法則での概算`,
                value: formatPercent(ruleOfTwoAndFour(outs, cards)),
                note: '暗算用の近似。アウツが多いと実際より高めに出る',
              },
              ...(cards === 2
                ? [{ label: '次の1枚で完成する確率', value: formatPercent(hitProbability(outs, unseen, 1)) }]
                : []),
            ]}
          />
        )}
      </div>
    </section>
  )
}

export function GeometricCard() {
  const [pot, setPot] = useState(5.5)
  const [stack, setStack] = useState(97.5)
  const [streets, setStreets] = useState(3)
  const ok = valid(pot, stack, streets)
  const plan = ok ? geometricBet(pot, stack, streets) : null
  return (
    <section className="card">
      <header className="card-header">ジオメトリックベット</header>
      <div className="card-body calc-body">
        <div className="field-triple">
          <NumberField label="ポット" value={pot} onChange={setPot} suffix="bb" />
          <NumberField label="有効スタック" value={stack} onChange={setStack} suffix="bb" />
          <NumberField label="残りストリート" value={streets} onChange={setStreets} step={1} min={1} />
        </div>
        {plan && (
          <>
            <Results
              rows={[
                {
                  label: '毎ストリートのベット',
                  value: `ポットの ${formatPercent(plan.betFraction)}`,
                  note: `SPR ${(stack / pot).toFixed(1)}。毎回同じポット比で打つと、最後のベットでちょうどオールインになる`,
                },
              ]}
            />
            <table className="plain-table">
              <thead>
                <tr>
                  <th>ストリート</th>
                  <th className="num">ポット</th>
                  <th className="num">ベット</th>
                  <th className="num">コール後のポット</th>
                </tr>
              </thead>
              <tbody>
                {plan.streets.map((s, i) => (
                  <tr key={i}>
                    <td>{i + 1} 回目</td>
                    <td className="num">{s.pot.toFixed(1)}</td>
                    <td className="num">{s.bet.toFixed(1)}</td>
                    <td className="num">{s.potAfterCall.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  )
}

export function EquityCard({ hero }: { hero?: Hero }) {
  const [cardsText, setCardsText] = useState(hero?.cards?.join('') ?? 'As5s')
  const [pot, setPot] = useState(22.5)
  const [bet, setBet] = useState(20.25)
  const required = requiredEquityAgainstBet(pot, bet)
  const [boardText, setBoardText] = useState('Ks 9s 2d')
  const [rangeText, setRangeText] = useState('TT+, AJs+, KQs, AQo+, K9s, KTs, QJs, JTs, 99:0.5')
  const [result, setResult] = useState<EquityResult | null>(null)
  const [error, setError] = useState('')

  let preview = null
  let rangeError = ''
  try {
    preview = buildStrategy([{ action: { kind: 'raise', label: 'レンジ' }, range: rangeText }])
  } catch (e) {
    rangeError = (e as Error).message
  }

  const calculate = () => {
    setError('')
    setResult(null)
    try {
      const { hole, board } = parseHand(cardsText, boardText)
      const ids = [...hole, ...board].map(cardToId)
      setResult(equityVsRange([ids[0], ids[1]], ids.slice(2), parseRange(rangeText)))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="card calc-wide">
      <header className="card-header">EQ（ハンド vs レンジ）</header>
      <div className="card-body equity-calc">
        <div className="calc-body">
          <div className="field-pair">
            <label className="field">
              <span>自分の手札</span>
              <input value={cardsText} onChange={(e) => setCardsText(e.target.value)} placeholder="AsKs" />
            </label>
            <label className="field">
              <span>ボード（空ならプリフロップ）</span>
              <input value={boardText} onChange={(e) => setBoardText(e.target.value)} placeholder="Ks 9s 2d" />
            </label>
          </div>
          <div className="field-pair">
            <NumberField label="ベット前のポット" value={pot} onChange={setPot} suffix="bb" />
            <NumberField label="相手のベット" value={bet} onChange={setBet} suffix="bb" />
          </div>
          <label className="field">
            <span>相手のレンジ（例: TT+, AJs+, KQo, 99:0.5）</span>
            <textarea rows={3} value={rangeText} onChange={(e) => setRangeText(e.target.value)} />
          </label>
          {rangeError && <p className="error small">{rangeError}</p>}
          <button className="btn primary" onClick={calculate} disabled={Boolean(rangeError)}>
            EQ を計算する
          </button>
          {error && <p className="error small">{error}</p>}
          {result && (
            <>
              <Results
                rows={[
                  { label: 'EQ', value: formatPercent(result.equity), note: `勝ち ${formatPercent(result.win)}・引き分け ${formatPercent(result.tie)}（${result.samples.toLocaleString()} 回の試行）` },
                  { label: 'このベットへの必要勝率', value: formatPercent(required) },
                ]}
              />
              <p className={result.equity > required ? 'verdict good' : 'verdict bad'}>
                {result.equity > required
                  ? 'EQ が必要勝率を上回っています。オールインならコールが +EV です。'
                  : 'EQ が必要勝率を下回っています。オールインならフォールドが正解です。'}
                オールインでなければ、後のストリートで EQ を実現しきれない（EQR）ことも考えてください。
              </p>
            </>
          )}
          <BoardPreview cardsText={cardsText} boardText={boardText} />
        </div>
        {preview && (
          <div className="mini-grid">
            <RangeGrid
              strategy={preview}
              mode="range"
              focusedAction={null}
              selectedHand={null}
              heroHand={null}
              onHover={() => {}}
              onSelect={() => {}}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function parseHand(cardsText: string, boardText: string): { hole: string[]; board: string[] } {
  const hole = parseHoleCards(cardsText)
  const board = parseCardList(boardText)
  if (board.length > 5) throw new Error('ボードは5枚までです')
  if (new Set([...hole, ...board]).size !== hole.length + board.length) {
    throw new Error('手札とボードに同じカードがあります')
  }
  return { hole, board }
}

function tryParseHand(cardsText: string, boardText: string) {
  try {
    return parseHand(cardsText, boardText)
  } catch {
    return null
  }
}

function BoardPreview({ cardsText, boardText }: { cardsText: string; boardText: string }) {
  const parsed = tryParseHand(cardsText, boardText)
  if (!parsed) return null
  return (
    <div className="board-preview-row">
      <BoardCards cards={parsed.hole} />
      {parsed.board.length > 0 && (
        <>
          <span className="muted small">on</span>
          <BoardCards cards={parsed.board} />
        </>
      )}
    </div>
  )
}
