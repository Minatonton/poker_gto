import { describe, expect, it } from 'vitest'
import {
  bluffRatio,
  geometricBet,
  hitProbability,
  allInCallEv,
  equityRealization,
  minimumDefenseFrequency,
  odds,
  requiredEquity,
  requiredEquityAgainstBet,
  ruleOfTwoAndFour,
} from './math'

describe('オッズと必要勝率', () => {
  it('ポット50に50のオールインをコールするとオッズは3、必要勝率は1/3', () => {
    expect(odds(100, 50)).toBe(3)
    expect(requiredEquity(100, 50)).toBeCloseTo(1 / 3)
  })

  it('3ベットへのコールは、真ん中にあるチップ全体とコール額から求める', () => {
    expect(odds(14.75, 8.75)).toBeCloseTo(2.69, 2)
    expect(requiredEquity(14.75, 8.75)).toBeCloseTo(0.372, 3)
  })

  it.each([
    [0.33, 0.2],
    [0.5, 0.25],
    [0.75, 0.3],
    [1, 1 / 3],
    [1.5, 0.375],
  ])('ポットの%sのベットに対する必要勝率は約%s', (fraction, expected) => {
    expect(requiredEquityAgainstBet(100, 100 * fraction)).toBeCloseTo(expected, 2)
  })
})

describe('MDF とブラフ比率', () => {
  it('ポットの半分のベットには約67%を守る必要がある', () => {
    expect(minimumDefenseFrequency(100, 50)).toBeCloseTo(2 / 3)
  })

  it('ブラフ比率は相手の必要勝率と等しい', () => {
    expect(bluffRatio(100, 50)).toBeCloseTo(requiredEquityAgainstBet(100, 50))
  })
})

describe('アウツ', () => {
  it('フロップから2枚めくる確率は、2倍4倍の法則と近い値になる', () => {
    expect(hitProbability(9, 47, 2)).toBeCloseTo(0.35, 2)
    expect(ruleOfTwoAndFour(9, 2)).toBeCloseTo(0.36)
  })

  it('1枚だけめくる確率はアウツ ÷ 見えていない枚数', () => {
    expect(hitProbability(9, 46, 1)).toBeCloseTo(9 / 46)
    expect(ruleOfTwoAndFour(9, 1)).toBeCloseTo(0.18)
  })
})

describe('geometricBet', () => {
  it('ポット100・スタック400を2ストリートで入れるなら、毎回ポットの100%を打つ', () => {
    const plan = geometricBet(100, 400, 2)
    expect(plan.betFraction).toBeCloseTo(1)
    expect(plan.streets.map((s) => s.potAfterCall)).toEqual([300, 900])
  })

  it('最後のストリートのベットでちょうどスタックを使い切る', () => {
    const plan = geometricBet(5.5, 97.5, 3)
    const totalBet = plan.streets.reduce((sum, s) => sum + s.bet, 0)
    expect(totalBet).toBeCloseTo(97.5)
  })
})

describe('コールの EV と EQR', () => {
  it('ポット 100 に 50 のオールインを EQ 40% でコールすると、平均 10 得をする', () => {
    expect(allInCallEv(100, 50, 0.4)).toBeCloseTo(10)
  })

  it('EQ がちょうど必要勝率なら、コールの EV は 0', () => {
    expect(allInCallEv(100, 50, requiredEquity(100, 50))).toBeCloseTo(0)
  })

  it('EQR は EV を「EQ どおりにポットを取れた場合」で割った値で、EQ が 0 なら出さない', () => {
    expect(equityRealization(30, 0.5, 100)).toBeCloseTo(0.6)
    expect(equityRealization(0, 0, 100)).toBeNull()
  })
})
