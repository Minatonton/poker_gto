import { useRef, useState } from 'react'
import { BoardCards } from '../components/postflop/Cards'
import { parseCardList } from '../poker/cards'
import { MISTAKE_KINDS, mergeReviews, newReview, type HandReview, type MistakeKind } from '../review/reviews'

interface Props {
  reviews: HandReview[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange: (reviews: HandReview[]) => void
  /** 記録したときのラインと手札を、プリフロップの卓で開き直す */
  onOpen: (review: HandReview) => void
}

/** 記録欄。Amu 氏の note「思考をハンドレビューする」の手順の順に並べている */
const STEPS: { key: keyof HandReview; label: string; placeholder: string }[] = [
  { key: 'myAction', label: '1. 自分が選んだアクション', placeholder: '例: フロップで 75% をベットした' },
  { key: 'thought', label: '1. そう判断した理由（思考の流れ）', placeholder: '例: トップペアで相手のドローを降ろしたかった' },
  { key: 'evSource', label: '4. EV がどこから生まれるか', placeholder: '例: 相手の弱いペアのコールから。ドローは降りてくれない' },
  { key: 'lesson', label: '5. 更新した知識', placeholder: '例: このボードでは BB のレンジにドローが多く、小さいサイズで広く打つ' },
  { key: 'nextTime', label: '5. 次に同じ場面でどうするか', placeholder: '例: 33% で打ち、ターンで大きくする' },
  { key: 'opponent', label: '相手の情報', placeholder: '例: コールが多い。リバーで大きく打つとほぼナッツ' },
]

const formatDate = (iso: string) => new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })

export function ReviewPage({ reviews, selectedId, onSelect, onChange, onOpen }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const selected = reviews.find((r) => r.id === selectedId) ?? null

  const update = (patch: Partial<HandReview>) => {
    if (!selected) return
    onChange(reviews.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)))
  }

  const add = () => {
    const review = newReview()
    onChange([review, ...reviews])
    onSelect(review.id)
  }

  const remove = () => {
    if (!selected) return
    onChange(reviews.filter((r) => r.id !== selected.id))
    onSelect(null)
    setConfirmDelete(false)
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(reviews, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `hand-reviews-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importJson = async (file: File) => {
    try {
      onChange(mergeReviews(reviews, JSON.parse(await file.text())))
      setMessage(`${file.name} を読み込みました`)
    } catch (e) {
      setMessage(`読み込めませんでした: ${(e as Error).message}`)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>ハンドレビュー</h1>
        <span className="caption">
          判断と思考の流れを残し、GTO とのずれの原因を分類して、次の判断の基準を更新します。記録はこのブラウザに保存されます。
        </span>
      </div>

      <div className="review-layout">
        <section className="card review-list">
          <header className="card-header">
            記録
            <span className="aside num">{reviews.length} 件</span>
          </header>
          <div className="card-body review-tools">
            <button className="btn primary" onClick={add}>
              新しく記録する
            </button>
            <button className="btn" onClick={exportJson} disabled={reviews.length === 0}>
              JSON に書き出す
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              JSON を読み込む
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importJson(file)
                e.target.value = ''
              }}
            />
            {message && <p className="muted small">{message}</p>}
          </div>
          <ul className="review-items">
            {reviews.length === 0 && (
              <li className="empty-note">
                まだ記録がありません。プリフロップの卓で「このハンドを記録する」を押すか、「新しく記録する」から始めてください。
              </li>
            )}
            {reviews.map((review) => (
              <li key={review.id}>
                <button
                  className={`review-item ${review.id === selectedId ? 'selected' : ''}`}
                  onClick={() => {
                    onSelect(review.id)
                    setConfirmDelete(false)
                  }}
                >
                  <span className="review-item-head">
                    <strong>{review.heroPosition ?? '席なし'}</strong>
                    <span className="num">{review.heroCards || '手札なし'}</span>
                    <span className="muted small">{formatDate(review.createdAt)}</span>
                  </span>
                  <span className="muted small">{review.mistakeKind || '原因は未分類'}</span>
                  {review.lesson && <span className="review-item-lesson">{review.lesson}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {selected ? (
          <section className="card">
            <header className="card-header">
              {selected.heroPosition ?? '席なし'} {selected.heroCards}
              <span className="aside">
                {selected.players === 2 ? 'ヘッズアップ' : `${selected.players}人卓`}・{formatDate(selected.createdAt)}
              </span>
            </header>
            <div className="card-body review-form">
              <div className="field-pair">
                <label className="field">
                  <span>手札</span>
                  <input value={selected.heroCards} onChange={(e) => update({ heroCards: e.target.value })} placeholder="AhKh" />
                </label>
                <label className="field">
                  <span>ボード</span>
                  <input value={selected.board} onChange={(e) => update({ board: e.target.value })} placeholder="Ks 9s 2d 7h" />
                </label>
              </div>
              <CardsPreview hole={selected.heroCards} board={selected.board} />

              <label className="field">
                <span>2. GTO の頻度（記録した時点の卓から自動で入ります。ソルブ結果を書き足しても構いません）</span>
                <textarea rows={2} value={selected.gtoSummary} onChange={(e) => update({ gtoSummary: e.target.value })} />
              </label>

              {STEPS.slice(0, 2).map((step) => (
                <ReviewField key={step.key} step={step} value={String(selected[step.key])} onChange={(v) => update({ [step.key]: v })} />
              ))}

              <label className="field">
                <span>3. ずれの原因</span>
                <select
                  value={selected.mistakeKind}
                  onChange={(e) => update({ mistakeKind: e.target.value as MistakeKind | '' })}
                >
                  <option value="">選んでください</option>
                  {MISTAKE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>

              {STEPS.slice(2).map((step) => (
                <ReviewField key={step.key} step={step} value={String(selected[step.key])} onChange={(v) => update({ [step.key]: v })} />
              ))}

              <div className="finished-actions">
                <button className="btn primary" onClick={() => onOpen(selected)} disabled={selected.choices.length === 0 && !selected.heroPosition}>
                  この局面を卓で開く
                </button>
                {confirmDelete ? (
                  <>
                    <button className="btn danger" onClick={remove}>
                      本当に削除する
                    </button>
                    <button className="btn" onClick={() => setConfirmDelete(false)}>
                      やめる
                    </button>
                  </>
                ) : (
                  <button className="btn" onClick={() => setConfirmDelete(true)}>
                    削除
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="card empty-state">
            <p>左の一覧から記録を選ぶと、ここで編集できます。</p>
          </section>
        )}
      </div>
    </>
  )
}

function ReviewField({
  step,
  value,
  onChange,
}: {
  step: (typeof STEPS)[number]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span>{step.label}</span>
      <textarea rows={2} value={value} placeholder={step.placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function tryCards(text: string): string[] {
  try {
    return parseCardList(text)
  } catch {
    return []
  }
}

function CardsPreview({ hole, board }: { hole: string; board: string }) {
  const holeCards = tryCards(hole)
  const boardCards = tryCards(board)
  if (holeCards.length === 0 && boardCards.length === 0) return null
  return (
    <div className="board-preview-row">
      {holeCards.length > 0 && <BoardCards cards={holeCards} />}
      {boardCards.length > 0 && (
        <>
          <span className="muted small">on</span>
          <BoardCards cards={boardCards} />
        </>
      )}
    </div>
  )
}
