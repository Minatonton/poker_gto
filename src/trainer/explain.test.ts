import { describe, expect, it } from 'vitest'
import { explainPostflop, explainPreflop, explainPreflopSize, memoryLine, type Reason } from './explain'

const textOf = (reasons: Reason[]) => reasons.map((r) => r.text).join()
const stepsOf = (reasons: Reason[]) => reasons.map((r) => r.step)

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
    expect(textOf(lines)).toContain('主に選ぶべきは Raise 2.5bb')
  })

  it('オープンを降りたときは、後ろの人数が少ないことを理由に挙げる', () => {
    const lines = explainPreflop({
      hand: 'K9o',
      actions: [raise, fold],
      frequencies: [1, 0],
      chosen: 1,
      playersBehind: 2,
    })
    expect(textOf(lines)).toContain('後ろが 2 人なら')
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
    expect(textOf(lines)).toContain('コールに必要な勝率は 27.3%')
    expect(textOf(lines)).toContain('BTN のレンジに対する EQ は 40.0%')
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
    expect(textOf(lines)).toContain('ドミネート')
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
    expect(textOf(lines)).toContain('ブロッカー')
  })

  it('混ぜているアクションを選んだときは、EV が等しいことを説明する', () => {
    const lines = explainPreflop({
      hand: '55',
      actions: [raise, fold],
      frequencies: [0.6, 0.4],
      chosen: 1,
      playersBehind: 5,
    })
    expect(textOf(lines)).toContain('混合戦略')
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
    expect(textOf(explainPostflop(base))).toContain('トップペア')
  })

  it('EV の差をポット比で示す', () => {
    expect(textOf(explainPostflop(base))).toContain('0.50bb（ポットの 9.1%）損')
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
    expect(textOf(lines)).toContain('コールに必要な勝率は 21.1%')
  })
})

describe('explainPreflopSize', () => {
  const open = { gtoAmount: 2.5, potBefore: 1.5, heroInvested: 0, opponent: 'BB', opponentInvested: 1 }

  it('両方の額で、相手がコールに必要な勝率を並べる', () => {
    const [{ text: numbers }] = explainPreflopSize({ ...open, chosenAmount: 2 })
    expect(numbers).toContain('2bb なら 22.2%')
    expect(numbers).toContain('2.5bb なら 27.3%')
  })

  it('小さすぎるときは、相手が安く広く参加できることを理由に挙げる', () => {
    const [, { text: reason }] = explainPreflopSize({ ...open, chosenAmount: 2 })
    expect(reason).toContain('安い値段で参加')
  })

  it('大きすぎるときは、弱い手が降りて強い手だけが残ることを理由に挙げる', () => {
    const [, { text: reason }] = explainPreflopSize({ ...open, chosenAmount: 4 })
    expect(reason).toContain('強い手が中心')
  })

  it('どちらの向きでも、GTO の額は釣り合いの点だと締める', () => {
    const lines = explainPreflopSize({ ...open, chosenAmount: 4 })
    expect(lines.at(-1)!.text).toContain('釣り合い')
  })
})

describe('考える順番', () => {
  it('プリフロップの解説は、場面・手札・結論の順に並ぶ', () => {
    const steps = stepsOf(
      explainPreflop({
        hand: 'K9o',
        actions: [fold, call],
        frequencies: [1, 0],
        chosen: 1,
        equity: 0.4,
        toCall: 1.5,
        potBeforeCall: 4,
        aggressor: 'BTN',
        playersBehind: 1,
      }),
    )
    expect(steps).toEqual(
      [...steps].sort((a, b) => ['scene', 'hand', 'verdict', 'memory'].indexOf(a) - ['scene', 'hand', 'verdict', 'memory'].indexOf(b)),
    )
    expect(steps[0]).toBe('scene')
    expect(steps.at(-1)).toBe('memory')
  })

  it('最後は覚えるための一言で締める', () => {
    const lines = explainPreflop({
      hand: 'A5s',
      actions: [raise, fold],
      frequencies: [0.7, 0.3],
      chosen: 0,
      playersBehind: 3,
      position: 'CO',
    })
    expect(lines.at(-1)!.text).toContain('「CO の A5s は')
  })

  it('額だけが違うときは、頻度の行を外せる', () => {
    const lines = explainPreflop({
      hand: 'A5s',
      actions: [raise, fold],
      frequencies: [1, 0],
      chosen: 0,
      playersBehind: 3,
      omitFrequency: true,
    })
    expect(textOf(lines)).not.toContain('最も多く選ばれます')
  })
})

describe('memoryLine', () => {
  it('頻度を、卓で思い出せる言葉に丸める', () => {
    expect(memoryLine('A5s ', [raise, fold], [0.7, 0.3])).toBe('「A5s は、たいてい Raise 2.5bb、ときどき Fold」。')
  })

  it('多い順に並べ、10% 未満のアクションは言わない', () => {
    expect(memoryLine('K9o ', [raise, call, fold], [0.05, 0.45, 0.5])).toBe(
      '「K9o は、半分ほど Fold、半分ほど Call」。',
    )
    expect(memoryLine('AA ', [raise, fold], [1, 0])).toBe('「AA は、いつも Raise 2.5bb」。')
  })
})

describe('手札の性質', () => {
  const open = { actions: [raise, fold], frequencies: [0, 1], chosen: 1, playersBehind: 3 }

  it('つながった低いオフスートは、キッカーではなくストレートの見込みで語る', () => {
    const text = textOf(explainPreflop({ ...open, hand: '65o' }))
    expect(text).toContain('ストレートの見込み')
    expect(text).not.toContain('ドミネート')
  })

  it('どの手札にも、手札の段の説明が付く', () => {
    expect(stepsOf(explainPreflop({ ...open, hand: 'Q2o' }))).toContain('hand')
  })
})

describe('選んだ額での呼び方', () => {
  it('「選んだ〜」の文は選んだ額で呼び、覚えるための一言は GTO の額のままにする', () => {
    const lines = explainPreflop({
      hand: 'AKs',
      actions: [raise, fold],
      frequencies: [0.15, 0.85],
      chosen: 0,
      playersBehind: 3,
      chosenLabel: 'Raise 4bb',
    })
    expect(lines.find((r) => r.text.startsWith('GTO の頻度'))!.text).toContain('選んだ Raise 4bb')
    expect(lines.at(-1)!.text).toContain('ときどき Raise 2.5bb')
  })
})
