import { describe, expect, it } from 'vitest'
import { explainPostflop, explainPreflop } from './explain'

const raise = { kind: 'raise' as const, label: 'Raise 2.5bb' }
const threeBet = { kind: 'raise' as const, label: '3Bet 11bb' }
const call = { kind: 'call' as const, label: 'Call' }
const check = { kind: 'call' as const, label: 'Check' }
const bet = { kind: 'raise' as const, label: 'Bet 1.82bb (33%)' }
const fold = { kind: 'fold' as const, label: 'Fold' }

describe('explainPreflop', () => {
  it('頻度を並べ、主に選ぶべきアクションを示す', () => {
    const lines = explainPreflop({
      hand: 'K9o',
      actions: [raise, fold],
      frequencies: [1, 0],
      chosen: 1,
      playersBehind: 2,
    })
    expect(lines[0]).toContain('主に選ぶべきは Raise 2.5bb')
  })

  it('オープンを降りたときは、後ろの人数が少ないことを理由に挙げる', () => {
    const lines = explainPreflop({
      hand: 'K9o',
      actions: [raise, fold],
      frequencies: [1, 0],
      chosen: 1,
      playersBehind: 2,
    })
    expect(lines.join()).toContain('後ろにいるのは 2 人だけ')
  })

  it('コールの判断では、必要勝率と相手のレンジに対する EQ を並べる', () => {
    const lines = explainPreflop({
      hand: 'T8s',
      actions: [threeBet, call, fold],
      frequencies: [0, 1, 0],
      chosen: 2,
      equity: 0.4,
      toCall: 1.5,
      potBeforeCall: 4,
      aggressor: 'BTN',
      playersBehind: 0,
    })
    expect(lines.join()).toContain('コールに必要な勝率は 27.3%')
    expect(lines.join()).toContain('BTN のレンジに対する EQ は 40.0%')
  })

  it('キッカーの弱いオフスートを降りるべきときは、ドミネートを理由に挙げる', () => {
    const lines = explainPreflop({
      hand: 'K3o',
      actions: [threeBet, call, fold],
      frequencies: [0, 0, 1],
      chosen: 1,
      equity: 0.335,
      toCall: 1.5,
      potBeforeCall: 4,
      playersBehind: 0,
    })
    expect(lines.join()).toContain('ドミネート')
  })

  it('A を持つスーテッドのブラフレイズでは、ブロッカーを理由に挙げる', () => {
    const lines = explainPreflop({
      hand: 'A5s',
      actions: [threeBet, call, fold],
      frequencies: [1, 0, 0],
      chosen: 1,
      equity: 0.42,
      toCall: 1.5,
      potBeforeCall: 4,
      playersBehind: 0,
    })
    expect(lines.join()).toContain('ブロッカー')
  })

  it('混ぜているアクションを選んだときは、EV が等しいことを説明する', () => {
    const lines = explainPreflop({
      hand: '55',
      actions: [raise, fold],
      frequencies: [0.6, 0.4],
      chosen: 1,
      playersBehind: 5,
    })
    expect(lines.join()).toContain('混合戦略')
  })
})

describe('explainPostflop', () => {
  const base = {
    cards: ['Ah', 'Kh'] as [string, string],
    board: ['Kd', '7c', '2s'],
    actions: [check, bet],
    frequencies: [0.2, 0.8],
    evs: [3, 3.5],
    chosen: 0,
    equity: 0.8,
    toCall: 0,
    pot: 5.5,
  }

  it('手札の分類と EQ の崩れにくさを説明する', () => {
    expect(explainPostflop(base).join()).toContain('トップペア')
  })

  it('EV の差をポット比で示す', () => {
    expect(explainPostflop(base).join()).toContain('0.50bb（ポットの 9.1%）損')
  })

  it('ベットを受けているときは必要勝率と比べる', () => {
    const lines = explainPostflop({
      ...base,
      actions: [fold, call],
      frequencies: [1, 0],
      evs: [0, -0.5],
      chosen: 1,
      equity: 0.2,
      toCall: 2,
      pot: 7.5,
    })
    expect(lines.join()).toContain('コールに必要な勝率は 21.1%')
  })
})
