import { useState, type ReactNode } from 'react'

export interface DockTab {
  id: string
  label: string
  content: ReactNode
}

interface Props {
  /** いま何をすればよいかを1行で伝える。卓の上端に重ねて出す */
  coach: ReactNode
  /** 卓の上端の右側に出す情報（連続正解など） */
  hud?: ReactNode
  table: ReactNode
  /** 卓の下端の操作パネル */
  controls: ReactNode
  tabs: DockTab[]
  /** 開いておくタブ。渡さなければ利用者が選んだタブを覚えておく */
  activeTab?: string
  onTabChange?: (id: string) => void
}

/**
 * 画面の高さに収まるゲーム画面。卓と操作を左に、詳しい情報を右のドックに置く。
 * ページ全体はスクロールさせず、量の多い情報はドックのタブの中だけでスクロールさせる。
 * 卓から目を離さずに答えとレンジを行き来できるようにするため
 */
export function GameScreen({ coach, hud, table, controls, tabs, activeTab, onTabChange }: Props) {
  return (
    <div className="game-screen">
      <section className="stage">
        <div className="stage-hud">
          <p className="coach" role="status">
            {coach}
          </p>
          {hud}
        </div>
        <div className="stage-table">{table}</div>
        <div className="stage-controls">{controls}</div>
      </section>
      <Dock tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  )
}

function Dock({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: DockTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
}) {
  const [picked, setPicked] = useState(tabs[0]?.id)
  const wanted = activeTab ?? picked
  // 手番が進んでタブが減ったときは、残っている先頭のタブを開く
  const current = tabs.find((tab) => tab.id === wanted) ?? tabs[0]
  const select = (id: string) => {
    setPicked(id)
    onTabChange?.(id)
  }
  return (
    <aside className="dock">
      <div className="dock-tabs" role="tablist">
        {tabs.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={tab.id === current?.id} onClick={() => select(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="dock-body" role="tabpanel">
        {current?.content}
      </div>
    </aside>
  )
}
