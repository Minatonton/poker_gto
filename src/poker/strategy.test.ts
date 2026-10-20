import { describe, expect, it } from 'vitest'
import { buildStrategy, overallFrequencies, type Action } from './strategy'

const raise: Action = { kind: 'raise', label: 'Raise' }
const call: Action = { kind: 'call', label: 'Call' }

describe('buildStrategy', () => {
  it('指定のないハンドはすべてフォールドになる', () => {
    const strategy = buildStrategy([{ action: raise, range: 'AA' }])
    expect(strategy.frequencies.get('72o')).toEqual([0, 1])
  })

  it('アクションに入らなかった残りの頻度がフォールドになる', () => {
    const strategy = buildStrategy([
      { action: raise, range: 'JJ:0.5' },
      { action: call, range: 'JJ:0.25' },
    ])
    expect(strategy.frequencies.get('JJ')).toEqual([0.5, 0.25, 0.25])
  })

  it('フォールドは常に最後のアクションになる', () => {
    const strategy = buildStrategy([{ action: raise, range: 'AA' }])
    expect(strategy.actions.map((a) => a.kind)).toEqual(['raise', 'fold'])
  })

  it('頻度の合計が1を超えるとエラーになる', () => {
    expect(() =>
      buildStrategy([
        { action: raise, range: 'AA' },
        { action: call, range: 'AA:0.5' },
      ]),
    ).toThrow('AA')
  })
})

describe('overallFrequencies', () => {
  it('コンボ数で重み付けした全体の頻度を返す', () => {
    const strategy = buildStrategy([{ action: raise, range: 'AA, AKs' }])
    const [raiseFreq, foldFreq] = overallFrequencies(strategy)
    expect(raiseFreq).toBeCloseTo(10 / 1326)
    expect(foldFreq).toBeCloseTo(1316 / 1326)
  })
})
