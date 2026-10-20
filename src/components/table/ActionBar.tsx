import { useEffect, useRef } from 'react'
import { isGtoSize } from '../../poker/betSizing'
import type { Action, ActionKind } from '../../poker/strategy'
import { actionColor } from '../actionColors'
import { playCue } from '../game/sound'
import { actionForKey } from './shortcuts'

interface Props {
  actions: Action[]
  /** amount は額を選ばせたときだけ渡る（bb） */
  onChoose: (index: number, amount?: number) => void
  disabled?: boolean
  /** レイズが1つしかないときに、額を選ばせる候補（bb）。プリフロップで使う */
  sizeChoices?: number[]
  /** 候補のうち GTO の額に印を付ける。壁打ちでは答えになってしまうので付けない */
  markGtoSize?: boolean
}

interface ButtonSpec {
  kind: ActionKind
  index: number
  amount?: number
  label: string
  color: string
  gto?: boolean
}

/** 「Bet 2.3bb (33%)」のような表示から、額の部分だけを取り出す。サイズのボタンは見出しの下に並ぶため */
const sizeLabel = (label: string) => label.replace(/^(Bet|Raise|3Bet|4Bet|Squeeze)\s+/, '')
const raiseName = (label: string) => label.split(' ')[0]
const ORDER: Record<ActionKind, number> = { fold: 0, call: 1, raise: 2 }

/**
 * 並べるボタン。Fold・Check/Call を左に、ベットとレイズは右の「サイズを選ぶ」まとまりに入れる。
 * ポーカーのクライアントと同じ並びにして、サイズを選ぶことが判断の一部だと分かるようにする
 */
function buttonsOf(actions: Action[], sizeChoices: number[] | undefined, markGtoSize: boolean) {
  const raises = actions.flatMap((action, index) => (action.kind === 'raise' ? [{ action, index }] : []))
  const plain: ButtonSpec[] = actions
    .flatMap((action, index) =>
      action.kind === 'raise' ? [] : [{ kind: action.kind, index, label: action.label, color: actionColor(action) }],
    )
    .sort((a, b) => ORDER[a.kind] - ORDER[b.kind])

  if (raises.length === 1 && sizeChoices && sizeChoices.length > 1) {
    const [{ action, index }] = raises
    const sizes: ButtonSpec[] = sizeChoices.map((amount) => ({
      kind: 'raise',
      index,
      amount,
      label: `${amount}bb`,
      color: actionColor(action),
      gto: markGtoSize && action.amount !== undefined && isGtoSize(amount, action.amount),
    }))
    return { plain, sizes, title: raiseName(action.label) }
  }
  if (raises.length === 1) {
    const [{ action, index }] = raises
    return {
      plain: [...plain, { kind: action.kind, index, label: action.label, color: actionColor(action) }],
      sizes: [],
      title: '',
    }
  }
  const sizes: ButtonSpec[] = raises.map(({ action, index }) => ({
    kind: action.kind,
    index,
    label: sizeLabel(action.label),
    color: actionColor(action),
  }))
  return { plain, sizes, title: raises.length > 0 ? raiseName(raises[0].action.label) : '' }
}

/**
 * 手番の人の操作ボタン。ゲームの操作パネルのように卓のすぐ下に大きく並べ、キーボードでも押せるようにする。
 * GTO の頻度はここには出さず、隣の「GTO の答え」に出す。ボタンは「実際に起きたこと」を入れる場所なので
 */
export function ActionBar({ actions, onChoose, disabled = false, sizeChoices, markGtoSize = false }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { plain, sizes, title } = buttonsOf(actions, sizeChoices, markGtoSize)
  const buttons = [...plain, ...sizes]

  const press = (button: ButtonSpec) => {
    playCue('action')
    onChoose(button.index, button.amount)
  }

  useEffect(() => {
    if (disabled) return
    const onKey = (event: KeyboardEvent) => {
      // 分析と壁打ちは切り替えても画面に残しているため、見えていない画面のボタンはキーに反応させない
      if (!ref.current || ref.current.offsetParent === null) return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const index = actionForKey(buttons, event.key)
      if (index !== null) {
        event.preventDefault()
        press(buttons[index])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const keyOf = (button: ButtonSpec) => {
    const position = buttons.indexOf(button)
    const letter = { fold: 'F', call: 'C', raise: 'R' }[button.kind]
    const firstOfKind = buttons.findIndex((b) => b.kind === button.kind) === position
    return firstOfKind ? `${position + 1} / ${letter}` : `${position + 1}`
  }

  return (
    <div className="action-buttons" ref={ref}>
      {plain.map((button) => (
        <button
          key={button.label}
          className={`action-button kind-${button.kind}`}
          style={{ '--action': button.color } as React.CSSProperties}
          onClick={() => press(button)}
          disabled={disabled}
        >
          <span className="action-button-label">{button.label}</span>
          <kbd className="action-key">{keyOf(button)}</kbd>
        </button>
      ))}
      {sizes.length > 0 && (
        <div className="size-panel" style={{ '--action': sizes[0].color } as React.CSSProperties}>
          <span className="size-panel-title">{title}：サイズを選ぶ</span>
          <div className="size-options">
            {sizes.map((button) => (
              <button
                key={button.label}
                className="action-button size-option kind-raise"
                style={{ '--action': button.color } as React.CSSProperties}
                onClick={() => press(button)}
                disabled={disabled}
              >
                <span className="action-button-label">{button.label}</span>
                {button.gto && <span className="size-gto">GTO</span>}
                <kbd className="action-key">{keyOf(button)}</kbd>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
