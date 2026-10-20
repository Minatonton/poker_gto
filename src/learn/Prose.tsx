import type { ReactNode } from 'react'

/** 覚える式。本文の中で目が止まるように、一行の囲みにする */
export function Formula({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="formula">
      <div className="formula-body">{children}</div>
      {note && <div className="formula-note">{note}</div>}
    </div>
  )
}

/** よくある誤解など、本文の流れから一歩外れた補足 */
export function Aside({ children }: { children: ReactNode }) {
  return <aside className="prose-aside">{children}</aside>
}
