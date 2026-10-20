import { useEffect, useRef } from 'react'
import type { Action } from '../../poker/strategy'
import { actionColor } from '../actionColors'
import { playCue } from '../game/sound'
import { actionForKey } from './shortcuts'

interface Props {
  actions: Action[]
  onChoose: (index: number) => void
  disabled?: boolean
}

/** ボタンに添えるキー。R は最初のベット・レイズにだけ割り当てている */
function shortcutOf(actions: Action[], index: number): string {
  const letter = { fold: 'F', call: 'C', raise: 'R' }[actions[index].kind]
  const firstOfKind = actions.findIndex((a) => a.kind === actions[index].kind) === index
  return firstOfKind ? `${index + 1} / ${letter}` : `${index + 1}`
}

/**
 * 手番の人の操作ボタン。ゲームの操作パネルのように卓のすぐ下に大きく並べ、キーボードでも押せるようにする。
 * GTO の頻度はここには出さず、隣の「GTO の答え」に出す。ボタンは「実際に起きたこと」を入れる場所なので
 */
export function ActionBar({ actions, onChoose, disabled = false }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (disabled) return
    const onKey = (event: KeyboardEvent) => {
      // 分析と壁打ちは切り替えても画面に残しているため、見えていない画面のボタンはキーに反応させない
      if (!ref.current || ref.current.offsetParent === null) return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const index = actionForKey(actions, event.key)
      if (index !== null) {
        event.preventDefault()
        playCue('action')
        onChoose(index)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions, onChoose, disabled])

  return (
    <div className="action-buttons" ref={ref}>
      {actions.map((action, index) => (
        <button
          key={action.label}
          className={`action-button kind-${action.kind}`}
          style={{ '--action': actionColor(action) } as React.CSSProperties}
          onClick={() => {
            playCue('action')
            onChoose(index)
          }}
          disabled={disabled}
        >
          <span className="action-button-label">{action.label}</span>
          <kbd className="action-key">{shortcutOf(actions, index)}</kbd>
        </button>
      ))}
    </div>
  )
}
