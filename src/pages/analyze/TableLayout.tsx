import type { ReactNode } from 'react'

interface Props {
  /** いま何をすればよいかを1行で伝える */
  coach: ReactNode
  table: ReactNode
  /** 卓のすぐ下の操作パネル */
  controls: ReactNode
  /** 卓の右側（GTO の答えとアクション履歴） */
  side: ReactNode
  /** 卓の下に置く詳しい情報 */
  below?: ReactNode
}

/** 分析画面の骨組み。卓と操作を中心に置き、答えはその右、詳しい情報はその下に置く */
export function TableLayout({ coach, table, controls, side, below }: Props) {
  return (
    <div className="page-stack">
      <div className="table-layout">
        <section className="card table-card">
          <p className="coach" role="status">
            {coach}
          </p>
          {table}
          <div className="controls">{controls}</div>
        </section>
        <div className="table-side">{side}</div>
      </div>
      {below}
    </div>
  )
}
