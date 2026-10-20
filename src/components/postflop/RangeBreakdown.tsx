import { useMemo } from 'react'
import { breakdownNode, type BreakdownRow } from '../../solver/breakdown'
import { toActions } from '../../solver/aggregate'
import type { PlayerNode } from '../../solver/types'
import type { Action } from '../../poker/strategy'
import { actionColor, formatPercent } from '../actionColors'

/**
 * 手番のレンジを役・ドロー・EQ の崩れにくさ（Robust / Vulnerable）で分けた内訳。
 * 「どの役でどれだけ打つか」を見ると、レンジ全体の戦略の組み立てが分かる
 */
export function RangeBreakdown({ node }: { node: PlayerNode }) {
  const breakdown = useMemo(() => breakdownNode(node), [node])
  const actions = toActions(node.actions, node.pot)
  const robustRows = [breakdown.robustness.robust, breakdown.robustness.middle, breakdown.robustness.vulnerable]

  return (
    <section className="card">
      <header className="card-header">
        レンジの構成
        <span className="aside legend">
          {actions.map((action) => (
            <span key={action.label} className="legend-item">
              <span className="swatch" style={{ background: actionColor(action) }} />
              {action.label}
            </span>
          ))}
        </span>
      </header>
      <BreakdownTable title="役" rows={breakdown.made} actions={actions} />
      {breakdown.draws.length > 0 && <BreakdownTable title="ドロー（役と重複して数える）" rows={breakdown.draws} actions={actions} />}
      <BreakdownTable title="EQ の崩れにくさ" rows={robustRows.filter((r) => r.combos > 0)} actions={actions} />
      <p className="panel-note">
        Robust は相手に打たれても EQ が残りやすいハンド（セット以上、ナッツフラッシュドロー、オープンエンドなど）、
        Vulnerable は打たれると EQ を手放しやすいハンド（弱いペア、A ハイなど）。
      </p>
    </section>
  )
}

function BreakdownTable({ title, rows, actions }: { title: string; rows: BreakdownRow[]; actions: Action[] }) {
  return (
    <table className="plain-table breakdown-table">
      <thead>
        <tr>
          <th>{title}</th>
          <th className="num">combos</th>
          <th className="num">割合</th>
          <th className="num">EQ</th>
          <th>戦略</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td className="num">{row.combos.toFixed(1)}</td>
            <td className="num">{formatPercent(row.share)}</td>
            <td className="num">{formatPercent(row.equity)}</td>
            <td>
              <span className="strategy-bar" title={actions.map((a, i) => `${a.label} ${formatPercent(row.frequencies[i])}`).join(' / ')}>
                {actions.map((action, i) => (
                  <span key={action.label} style={{ width: `${row.frequencies[i] * 100}%`, background: actionColor(action) }} />
                ))}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
