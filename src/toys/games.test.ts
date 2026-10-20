import { describe, expect, it } from 'vitest'
import { akqBestResponses, akqBettorEv, akqEquilibrium, rpsBestResponse, rpsEv, rpsEvs } from './games'

describe('じゃんけん', () => {
  const third = { rock: 1 / 3, paper: 1 / 3, scissors: 1 / 3 }

  it('相手が均等に出すなら、どの手も EV は0（GTO 同士の EV は0）', () => {
    const evs = rpsEvs(third)
    expect(evs.rock).toBeCloseTo(0)
    expect(evs.paper).toBeCloseTo(0)
  })

  it('相手がグーに偏っていればパーが最善で、EV はプラスになる', () => {
    const biased = { rock: 0.4, paper: 0.3, scissors: 0.3 }
    expect(rpsBestResponse(biased)).toBe('paper')
    expect(rpsEvs(biased).paper).toBeCloseTo(0.1)
  })

  it('均等に出していれば、相手がどう偏っても EV は0のまま（搾取されない）', () => {
    expect(rpsEv(third, { rock: 0.8, paper: 0.1, scissors: 0.1 })).toBeCloseTo(0)
  })
})

describe('AKQ ゲーム', () => {
  it('ポットと同額のベットでは、Q の半分でブラフし、K の半分でコールする', () => {
    const eq = akqEquilibrium(1, 1)
    expect(eq.bluffFrequency).toBeCloseTo(0.5)
    expect(eq.callFrequency).toBeCloseTo(0.5)
  })

  it('均衡では、受ける側の頻度を変えても打つ側の EV は変わらない', () => {
    const eq = akqEquilibrium(1, 1)
    expect(akqBettorEv(1, 1, eq.bluffFrequency, 0)).toBeCloseTo(akqBettorEv(1, 1, eq.bluffFrequency, 1))
  })

  it('ベットを大きくするほど、打つ側の均衡の EV は上がる（オールインが最適）', () => {
    const evs = [0.5, 1, 2, 4].map((bet) => akqEquilibrium(1, bet).bettorEv)
    expect(evs).toEqual([...evs].sort((a, b) => a - b))
  })

  it('相手のブラフが多すぎれば必ずコール、相手のコールが少なすぎれば必ずブラフ', () => {
    const responses = akqBestResponses(1, 1, 0.8, 0.2)
    expect(responses.caller).toBe('必ずコール')
    expect(responses.bettor).toBe('必ずブラフ')
  })
})
