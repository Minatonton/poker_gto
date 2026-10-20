import { useEffect, useMemo, useRef, useState } from 'react'
import { actionColor, formatPercent } from '../components/actionColors'
import { BoardCards } from '../components/postflop/Cards'
import { Segmented } from '../components/Segmented'
import { displayBoard, parseCardList } from '../poker/cards'
import type { PostflopSpot } from '../poker/postflopSpot'
import { boardTexture, REPRESENTATIVE_FLOPS, type SuitTexture } from '../poker/texture'
import { toActions } from '../solver/aggregate'
import { SolverClient } from '../solver/client'
import { spotConfig, type StreetSizeOptions } from '../solver/spotConfig'
import { CHIPS_PER_BB, type ReportRow, type ReportStatus, type StrategySummary } from '../solver/types'

/**
 * 1枚ごとに解く時間を抑えるため、ベットサイズは各ストリート1つにしている。
 * 集合分析で見たいのはフロップの打つ頻度の傾向で、細かいサイズの使い分けではないため
 */
const REPORT_SIZES: StreetSizeOptions = {
  flop: { bet: '33%', raise: '' },
  turn: { bet: '75%', raise: '' },
  river: { bet: '75%', raise: '' },
}

const POLL_MS = 2000

type SortKey = 'board' | 'oopEquity' | 'oopBet' | 'ipBet'
type SuitFilter = SuitTexture | 'all'
type PairFilter = 'all' | 'paired' | 'unpaired'
type HighFilter = 'all' | 'A' | 'K' | 'Q' | 'J' | 'low'

/** レンジ全体が攻撃的なアクション（ベット・レイズ・オールイン）を選ぶ割合 */
function betFrequency(summary: StrategySummary | null): number {
  if (!summary) return 0
  return summary.actions.reduce(
    (sum, a, i) => (a.kind === 'bet' || a.kind === 'raise' || a.kind === 'allin' ? sum + summary.frequencies[i] : sum),
    0,
  )
}

const boardOf = (row: ReportRow) => parseCardList(row.board)

const SORT_VALUES: Record<SortKey, (row: ReportRow) => number | string> = {
  board: (row) => row.board,
  oopEquity: (row) => row.ranges[0].equity,
  oopBet: (row) => betFrequency(row.oop),
  ipBet: (row) => betFrequency(row.ipAfterCheck),
}

export function ReportPage({ spot, onOpenPreflop }: { spot: PostflopSpot | null; onOpenPreflop: () => void }) {
  const clientRef = useRef(new SolverClient())
  const [count, setCount] = useState(REPRESENTATIVE_FLOPS.length)
  const [maxIterations, setMaxIterations] = useState(60)
  const [status, setStatus] = useState<ReportStatus | null>(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: 'oopBet', descending: true })
  const [suitFilter, setSuitFilter] = useState<SuitFilter>('all')
  const [pairFilter, setPairFilter] = useState<PairFilter>('all')
  const [highFilter, setHighFilter] = useState<HighFilter>('all')

  useEffect(() => {
    let timer: number | undefined
    const poll = async () => {
      try {
        const next = await clientRef.current.reportStatus()
        setStatus(next)
        if (next.state === 'running') timer = window.setTimeout(poll, POLL_MS)
      } catch (e) {
        setError((e as Error).message)
      }
    }
    poll()
    return () => window.clearTimeout(timer)
  }, [status?.state])

  const start = async () => {
    if (!spot) return
    setError('')
    const flops = REPRESENTATIVE_FLOPS.slice(0, count).map((flop) => flop.join(''))
    const config = spotConfig(spot, '', REPORT_SIZES)
    try {
      await clientRef.current.startReport(config, flops, {
        maxIterations,
        targetExploitability: (config.startingPot * 1) / 100,
      })
      setStatus(await clientRef.current.reportStatus())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const rows = useMemo(() => {
    const filtered = (status?.rows ?? []).filter((row) => {
      const texture = boardTexture(boardOf(row))
      if (suitFilter !== 'all' && texture.suits !== suitFilter) return false
      if (pairFilter === 'paired' && !texture.paired) return false
      if (pairFilter === 'unpaired' && texture.paired) return false
      if (highFilter === 'low' && 'AKQJ'.includes(texture.highCard)) return false
      if (highFilter !== 'all' && highFilter !== 'low' && texture.highCard !== highFilter) return false
      return true
    })
    const value = SORT_VALUES[sort.key]
    return [...filtered].sort((a, b) => {
      const [x, y] = [value(a), value(b)]
      const order = x < y ? -1 : x > y ? 1 : 0
      return sort.descending ? -order : order
    })
  }, [status, sort, suitFilter, pairFilter, highFilter])

  const average = (pick: (row: ReportRow) => number) =>
    rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + pick(row), 0) / rows.length

  const exportCsv = () => {
    const header = 'board,suits,paired,connected,oop_equity,ip_equity,oop_bet,ip_bet_after_check'
    const lines = rows.map((row) => {
      const t = boardTexture(boardOf(row))
      return [
        row.board,
        t.suits,
        t.paired,
        t.connected,
        row.ranges[0].equity,
        row.ranges[1].equity,
        betFrequency(row.oop),
        betFrequency(row.ipAfterCheck),
      ]
        .map((v) => (typeof v === 'number' ? v.toFixed(4) : String(v)))
        .join(',')
    })
    const url = URL.createObjectURL(new Blob([[header, ...lines].join('\n')], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'flop-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const header = (key: SortKey, label: string) => (
    <th className={key === 'board' ? '' : 'num'}>
      <button
        className="sort-button"
        onClick={() => setSort({ key, descending: sort.key === key ? !sort.descending : true })}
      >
        {label}
        {sort.key === key ? (sort.descending ? ' ▼' : ' ▲') : ''}
      </button>
    </th>
  )

  if (!spot) {
    return (
      <>
        <div className="page-header">
          <h1>集合分析</h1>
        </div>
        <section className="card empty-state">
          <p>
            「ハンドを分析」の卓でフロップまでアクションを進めると、そのスポットの複数のフロップを、ここでまとめて解いて見比べられます。
          </p>
          <button className="btn primary" onClick={onOpenPreflop}>
            ハンドを分析する
          </button>
        </section>
      </>
    )
  }

  const running = status?.state === 'running'
  const finished = (status?.rows.length ?? 0) + (status?.failures.length ?? 0)

  return (
    <>
      <div className="page-header">
        <h1>集合分析</h1>
        <span className="caption">
          {spot.name}を、代表的なフロップでまとめて解き、ボードの特徴ごとの戦略の傾向を見ます。
        </span>
      </div>

      <section className="card">
        <div className="card-body scenario">
          <p className="muted small">
            ベットサイズは各ストリート1つ（フロップ 33%、ターン・リバー 75%）に絞り、精度はポットの 1%
            を目標にしています。 1枚あたり数十秒から数分かかります。実行中はポストフロップのソルブを使えません。
          </p>
          <div className="field-pair">
            <label className="field">
              <span>解くフロップの数（全 {REPRESENTATIVE_FLOPS.length} 枚）</span>
              <input
                type="number"
                min={1}
                max={REPRESENTATIVE_FLOPS.length}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>1枚あたりの最大反復回数</span>
              <input
                type="number"
                min={10}
                value={maxIterations}
                onChange={(e) => setMaxIterations(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="finished-actions">
            <button className="btn primary" onClick={start} disabled={running}>
              集合分析を始める
            </button>
            {running && (
              <button className="btn" onClick={() => clientRef.current.stopReport()}>
                中断する
              </button>
            )}
            {rows.length > 0 && (
              <button className="btn" onClick={exportCsv}>
                CSV に書き出す
              </button>
            )}
          </div>
          {running && status && (
            <div className="progress">
              <div className="progress-track">
                <span style={{ width: `${(finished / status.total) * 100}%` }} />
              </div>
              <div className="progress-stats">
                <span className="num">
                  {finished} / {status.total} 枚
                </span>
                {status.current && (
                  <span>解いているボード: {displayBoard(parseCardList(status.current)).join(' ')}</span>
                )}
              </div>
            </div>
          )}
          {error && <p className="error small">{error}</p>}
          {status?.failures.map((f) => (
            <p key={f.board} className="error small">
              {f.board}: {f.message}
            </p>
          ))}
        </div>
      </section>

      {(status?.rows.length ?? 0) > 0 && (
        <section className="card">
          <div className="card-body scenario">
            <Segmented<SuitFilter>
              label="スート"
              options={[
                { value: 'all', label: 'すべて' },
                { value: 'レインボー', label: 'レインボー' },
                { value: 'ツートーン', label: 'ツートーン' },
                { value: 'モノトーン', label: 'モノトーン' },
              ]}
              value={suitFilter}
              onChange={setSuitFilter}
            />
            <Segmented<PairFilter>
              label="ペア"
              options={[
                { value: 'all', label: 'すべて' },
                { value: 'unpaired', label: 'ペアなし' },
                { value: 'paired', label: 'ペアあり' },
              ]}
              value={pairFilter}
              onChange={setPairFilter}
            />
            <Segmented<HighFilter>
              label="ハイカード"
              options={[
                { value: 'all', label: 'すべて' },
                { value: 'A', label: 'A' },
                { value: 'K', label: 'K' },
                { value: 'Q', label: 'Q' },
                { value: 'J', label: 'J' },
                { value: 'low', label: 'T 以下' },
              ]}
              value={highFilter}
              onChange={setHighFilter}
            />
          </div>
          <table className="plain-table report-table">
            <thead>
              <tr>
                {header('board', 'ボード')}
                <th>特徴</th>
                {header('oopEquity', `${spot.oop} の EQ`)}
                {header('oopBet', `${spot.oop} のベット頻度`)}
                <th>{spot.oop} の戦略</th>
                {header('ipBet', `${spot.ip} のベット頻度（チェック後）`)}
                <th>{spot.ip} の戦略</th>
              </tr>
            </thead>
            <tbody>
              <tr className="average-row">
                <td>平均（{rows.length} 枚）</td>
                <td />
                <td className="num">{formatPercent(average((r) => r.ranges[0].equity))}</td>
                <td className="num">{formatPercent(average((r) => betFrequency(r.oop)))}</td>
                <td />
                <td className="num">{formatPercent(average((r) => betFrequency(r.ipAfterCheck)))}</td>
                <td />
              </tr>
              {rows.map((row) => {
                const texture = boardTexture(boardOf(row))
                return (
                  <tr key={row.board}>
                    <td>
                      <BoardCards cards={displayBoard(boardOf(row))} />
                    </td>
                    <td className="small">
                      {texture.suits}
                      {texture.paired ? '・ペア' : ''}
                      {texture.connected ? '・つながり' : ''}
                    </td>
                    <td className="num">{formatPercent(row.ranges[0].equity)}</td>
                    <td className="num">{formatPercent(betFrequency(row.oop))}</td>
                    <td>
                      <SummaryBar summary={row.oop} />
                    </td>
                    <td className="num">{formatPercent(betFrequency(row.ipAfterCheck))}</td>
                    <td>{row.ipAfterCheck && <SummaryBar summary={row.ipAfterCheck} />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

function SummaryBar({ summary }: { summary: StrategySummary }) {
  // 行ごとのポット比の表示は比較に使わないため、ラベルから外している
  const actions = toActions(summary.actions, CHIPS_PER_BB)
  return (
    <span
      className="strategy-bar"
      title={actions
        .map((a, i) => `${a.label.replace(/ \(\d+%\)/, '')} ${formatPercent(summary.frequencies[i])}`)
        .join(' / ')}
    >
      {actions.map((action, i) => (
        <span
          key={action.label}
          style={{ width: `${summary.frequencies[i] * 100}%`, background: actionColor(action) }}
        />
      ))}
    </span>
  )
}
