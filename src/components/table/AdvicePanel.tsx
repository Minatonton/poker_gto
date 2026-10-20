import type { Action } from '../../poker/strategy'
import { actionColor, formatPercent } from '../actionColors'

export interface HandAdvice {
  /** 例: AQs、AhQh */
  label: string
  frequencies: number[]
  /** bb。ソルブ結果のときだけ */
  evs?: number[]
  equity?: number
}

interface Props {
  actor: string
  actions: Action[]
  /** 手番の人のレンジ全体の頻度 */
  rangeFrequencies: number[]
  /** 手番が自分で手札が分かっているとき */
  hand?: HandAdvice
  hidden: boolean
  onToggleHidden: () => void
  /** 手番が自分でないときの補足 */
  note?: string
}

/** 「GTO の答え」。操作ボタンのすぐ隣に、まず結論（いちばん多く選ぶアクション）を大きく出す */
export function AdvicePanel({ actor, actions, rangeFrequencies, hand, hidden, onToggleHidden, note }: Props) {
  const frequencies = hand?.frequencies ?? rangeFrequencies
  const best = frequencies.indexOf(Math.max(...frequencies))

  return (
    <section className="card advice">
      <header className="card-header">
        GTO の答え
        <button className="btn small-btn aside-btn" onClick={onToggleHidden}>
          {hidden ? '答えを見る' : '答えを隠す'}
        </button>
      </header>
      {hidden ? (
        <p className="empty-note">自分で考えてからアクションを選び、あとで答えを見られます。</p>
      ) : (
        <div className="advice-body">
          <p className="advice-subject">
            {hand ? (
              <>
                あなたの <strong>{hand.label}</strong>（{actor}）
              </>
            ) : (
              <>
                <strong>{actor}</strong> のレンジ全体
              </>
            )}
          </p>
          <p className="advice-answer" style={{ color: actionColor(actions[best]) }}>
            {actions[best]?.label}
            <span className="advice-answer-freq num">{formatPercent(frequencies[best] ?? 0)}</span>
          </p>
          <ul className="advice-bars">
            {actions.map((action, i) => (
              <li key={action.label}>
                <span className="advice-bar-label">{action.label}</span>
                <span className="advice-bar-track">
                  <span style={{ width: `${(frequencies[i] ?? 0) * 100}%`, background: actionColor(action) }} />
                </span>
                <span className="num">{formatPercent(frequencies[i] ?? 0)}</span>
                {hand?.evs && <span className="num muted advice-ev">{hand.evs[i].toFixed(2)}bb</span>}
              </li>
            ))}
          </ul>
          {hand?.equity !== undefined && (
            <p className="muted small">
              エクイティ <strong className="num">{formatPercent(hand.equity)}</strong>
              {hand.evs && '・右の数字は各アクションの EV'}
            </p>
          )}
          {note && <p className="muted small">{note}</p>}
        </div>
      )}
    </section>
  )
}
