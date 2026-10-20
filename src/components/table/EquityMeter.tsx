import { formatPercent } from '../actionColors'

interface Props {
  /** 例: 「A♠K♠ vs UTG のレンジ」 */
  subject: string
  /** 0〜1。null は計算できなかったとき */
  equity: number | null
  /** コールに必要な勝率。払わずに続けられるときは渡さない */
  required?: number
  /** コールの EV（bb）と、その値の前提の説明 */
  callEv?: { value: number; note: string }
  /** そのハンドの EV（bb）。ソルブ結果があるときだけ */
  ev?: number
  eqr?: number | null
  note?: string
}

/**
 * 勝率メーター。EQ のバーに必要勝率の目盛りを重ね、足りているかを一目で分かるようにする。
 * 数字を並べるだけだと、どちらが大きいかを読み比べる手間が残るため
 */
export function EquityMeter({ subject, equity, required, callEv, ev, eqr, note }: Props) {
  const enough = equity !== null && required !== undefined ? equity >= required : null
  return (
    <section className="card equity-meter">
      <header className="card-header">
        EV / EQ
        <span className="aside">{subject}</span>
      </header>
      <div className="card-body">
        <div className="meter-head">
          <span className="meter-label">あなたの EQ</span>
          <strong className="meter-value num" key={equity ?? 'none'}>
            {equity === null ? '—' : formatPercent(equity)}
          </strong>
        </div>
        <div className="meter-track" role="img" aria-label={`EQ ${equity === null ? '不明' : formatPercent(equity)}`}>
          <span
            className={`meter-fill ${enough === null ? '' : enough ? 'enough' : 'short'}`}
            style={{ width: `${(equity ?? 0) * 100}%` }}
          />
          {required !== undefined && (
            <span className="meter-mark" style={{ left: `${required * 100}%` }} title="コールに必要な勝率" />
          )}
        </div>
        {required !== undefined && equity !== null && (
          <p className={`meter-verdict ${enough ? 'enough' : 'short'}`}>
            コールに必要な勝率 {formatPercent(required)} を
            {enough
              ? ` ${formatPercent(equity - required)} 上回っています`
              : ` ${formatPercent(required - equity)} 下回っています`}
          </p>
        )}
        <dl className="meter-stats">
          {callEv && (
            <div>
              <dt>
                コールの EV<span className="muted small">（{callEv.note}）</span>
              </dt>
              <dd className={`num ${callEv.value >= 0 ? 'plus' : 'minus'}`}>
                {callEv.value >= 0 ? '+' : ''}
                {callEv.value.toFixed(2)}bb
              </dd>
            </div>
          )}
          {ev !== undefined && (
            <div>
              <dt>このハンドの EV</dt>
              <dd className="num">{ev.toFixed(2)}bb</dd>
            </div>
          )}
          {eqr !== undefined && eqr !== null && (
            <div>
              <dt title="EV ÷ (EQ × ポット)。100% を超えると EQ 以上にポットを取れている">EQR（EQ の実現率）</dt>
              <dd className="num">{formatPercent(eqr)}</dd>
            </div>
          )}
        </dl>
        {note && <p className="muted small">{note}</p>}
      </div>
    </section>
  )
}
