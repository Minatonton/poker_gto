import type { ReactNode } from 'react'

export interface HistoryEntry {
  actor: string
  label: string
  color?: string
  /** 自動でフォールド扱いにしたなど、選び直せない行 */
  disabled?: boolean
  /** この行より前の状態に戻すときに呼ぶ */
  onRewind?: () => void
}

interface Props {
  entries: HistoryEntry[]
  /** 履歴の下に出す内容（次の手番の案内など） */
  footer?: ReactNode
}

/** ハンド履歴のように、アクションを上から順に並べる。行を押すとその手前に戻る */
export function HandHistory({ entries, footer }: Props) {
  return (
    <section className="card hand-history">
      <header className="card-header">
        アクション履歴
        <span className="aside">行を押すとそこからやり直せます</span>
      </header>
      <ol className="history-list">
        {entries.length === 0 && <li className="muted small history-empty">まだアクションはありません</li>}
        {entries.map((entry, index) => (
          <li key={index}>
            <button
              type="button"
              className="history-row"
              disabled={entry.disabled || !entry.onRewind}
              onClick={entry.onRewind}
            >
              <span className="history-actor">{entry.actor}</span>
              <span className="history-action" style={{ color: entry.color }}>
                {entry.label}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {footer && <div className="history-footer">{footer}</div>}
    </section>
  )
}
