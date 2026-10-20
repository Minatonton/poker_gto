import { useEffect, useMemo, useState } from 'react'
import { actionColor, formatPercent } from '../components/actionColors'
import { RangeGrid } from '../components/RangeGrid'
import { Segmented } from '../components/Segmented'
import type { HandClass } from '../poker/hands'
import { walkPreflop, type Position, type PreflopSolution, type Walk } from '../poker/preflop'
import type { Strategy } from '../poker/strategy'
import { drillChoices, PREFLOP_DRILLS, type PreflopDrillKind } from '../trainer/preflopDrill'
import { emptyPainting, matchScore, mistakes, paint, PAINT_AMOUNTS } from '../trainer/rangeDrill'

type DecidingWalk = Extract<Walk, { status: 'deciding' }>

function newSpot(solution: PreflopSolution, kind: PreflopDrillKind, seat: Position | 'random'): DecidingWalk | null {
  const choices = drillChoices(solution, kind, seat === 'random' ? null : seat)
  if (!choices) return null
  const walk = walkPreflop(solution, choices)
  return walk.status === 'deciding' ? walk : null
}

/** 塗り絵でレンジを再現し、GTO との一致率で採点する */
export function RangeDrillPage({ solution }: { solution: PreflopSolution }) {
  const [kind, setKind] = useState<PreflopDrillKind>('rfi')
  const [seat, setSeat] = useState<Position | 'random'>('random')
  const [walk, setWalk] = useState<DecidingWalk | null>(() => newSpot(solution, 'rfi', 'random'))
  const [painting, setPainting] = useState(() => (walk ? emptyPainting(walk.strategy) : new Map()))
  const [brushAction, setBrushAction] = useState(0)
  const [brushAmount, setBrushAmount] = useState<number>(1)
  const [dragging, setDragging] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const stop = () => setDragging(false)
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  const start = (nextKind = kind, nextSeat = seat) => {
    const next = newSpot(solution, nextKind, nextSeat)
    setWalk(next)
    setPainting(next ? emptyPainting(next.strategy) : new Map())
    setBrushAction(0)
    setChecked(false)
  }

  const gto = walk?.strategy
  const userStrategy: Strategy | null = useMemo(
    () => (gto ? { actions: gto.actions, frequencies: painting, weights: gto.weights } : null),
    [gto, painting],
  )
  const marked = useMemo(() => (checked && gto ? mistakes(painting, gto) : undefined), [checked, gto, painting])

  const paintHand = (hand: HandClass) => {
    if (!gto || checked) return
    const foldIndex = gto.actions.length - 1
    setPainting((current) => new Map(current).set(hand, paint(current.get(hand) ?? [], brushAction, brushAmount, foldIndex)))
  }

  return (
    <>
      <div className="page-header">
        <h1>レンジ暗記</h1>
        <span className="caption">GTO のレンジを自分で塗り、答え合わせで一致率を確かめます。25% 刻みで塗れます。</span>
      </div>

      <section className="card">
        <div className="card-body scenario">
          <Segmented<PreflopDrillKind>
            label="種類"
            options={PREFLOP_DRILLS.map((d) => ({ value: d.kind, label: d.label }))}
            value={kind}
            onChange={(value) => {
              setKind(value)
              start(value, seat)
            }}
          />
          <Segmented<Position | 'random'>
            label="手番の席"
            options={[{ value: 'random', label: 'ランダム' }, ...solution.positions.map((p) => ({ value: p, label: p }))]}
            value={seat}
            onChange={(value) => {
              setSeat(value)
              start(kind, value)
            }}
          />
        </div>
      </section>

      {!walk || !gto || !userStrategy ? (
        <section className="card">
          <p className="empty-note">この席には、この種類の手番が来ません。席か種類を変えてください。</p>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="action-line">
              {walk.steps
                .filter((s) => s.strategy !== null)
                .map((step, i) => (
                  <span key={i} className="step static" style={{ '--action': actionColor(step.action) } as React.CSSProperties}>
                    <span className="step-actor">{step.position}</span>
                    <span className="step-action">{step.action.label}</span>
                  </span>
                ))}
              <span className="step static current-step">
                <span className="step-actor">出題</span>
                <span className="step-action">{walk.position} のレンジ</span>
              </span>
            </div>
            <div className="card-body scenario">
              <Segmented<string>
                label="塗るアクション"
                options={gto.actions.map((a, i) => ({ value: String(i), label: a.label }))}
                value={String(brushAction)}
                onChange={(value) => setBrushAction(Number(value))}
              />
              <Segmented<string>
                label="頻度"
                options={PAINT_AMOUNTS.map((amount) => ({ value: String(amount), label: formatPercent(amount).replace('.0', '') }))}
                value={String(brushAmount)}
                onChange={(value) => setBrushAmount(Number(value))}
              />
              <div className="finished-actions">
                {checked ? (
                  <button className="btn primary" onClick={() => start()}>
                    次の問題
                  </button>
                ) : (
                  <button className="btn primary" onClick={() => setChecked(true)}>
                    答え合わせ
                  </button>
                )}
                <button
                  className="btn"
                  onClick={() => {
                    setPainting(emptyPainting(gto))
                    setChecked(false)
                  }}
                >
                  塗り直す
                </button>
              </div>
            </div>
          </section>

          {checked && (
            <section className="card">
              <div className="card-body drill-result">
                <span className="muted small">一致率</span>
                <strong className="num">{formatPercent(matchScore(painting, gto))}</strong>
                <span className="muted small">
                  印の付いたセルは GTO と 25% 以上ずれています（{marked?.size ?? 0} ハンド）。右が GTO の答えです。
                </span>
              </div>
            </section>
          )}

          <div className={checked ? 'drill-grids' : 'drill-grids single'}>
            <section className="card grid-card">
              <p className="muted small grid-caption">あなたのレンジ（クリック・ドラッグで塗る）</p>
              <div onMouseDown={() => setDragging(true)}>
                <RangeGrid
                  strategy={userStrategy}
                  mode="strategy"
                  focusedAction={null}
                  selectedHand={null}
                  heroHand={null}
                  markedHands={marked}
                  onHover={(hand) => dragging && hand && paintHand(hand)}
                  onSelect={() => {}}
                  onCellDown={paintHand}
                />
              </div>
            </section>
            {checked && (
              <section className="card grid-card">
                <p className="muted small grid-caption">GTO</p>
                <RangeGrid
                  strategy={gto}
                  mode="strategy"
                  focusedAction={null}
                  selectedHand={null}
                  heroHand={null}
                  markedHands={marked}
                  onHover={() => {}}
                  onSelect={() => {}}
                />
              </section>
            )}
          </div>
        </>
      )}
    </>
  )
}
