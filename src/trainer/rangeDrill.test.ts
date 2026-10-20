import { describe, expect, it } from 'vitest'
import { buildStrategy } from '../poker/strategy'
import { emptyPainting, handOverlap, matchScore, mistakes, paint } from './rangeDrill'

const raise = { kind: 'raise' as const, label: 'Raise' }
const call = { kind: 'call' as const, label: 'Call' }

describe('paint', () => {
  it('塗ったアクションを指定の頻度にし、残りを fold にする', () => {
    expect(paint([0, 0, 1], 0, 0.75, 2)).toEqual([0.75, 0, 0.25])
  })

  it('他のアクションは合計が1を超えない範囲で残す', () => {
    expect(paint([0.5, 0, 0.5], 1, 0.5, 2)).toEqual([0.5, 0.5, 0])
  })

  it('合計が1を超えるときは、他のアクションを縮める', () => {
    expect(paint([0.5, 0.5, 0], 0, 1, 2)).toEqual([1, 0, 0])
  })
})

describe('handOverlap', () => {
  it('同じ頻度なら1、まったく違えば0', () => {
    expect(handOverlap([1, 0], [1, 0])).toBe(1)
    expect(handOverlap([0, 1], [1, 0])).toBe(0)
    expect(handOverlap([0.5, 0.5], [1, 0])).toBe(0.5)
  })
})

describe('matchScore', () => {
  const gto = buildStrategy([{ action: raise, range: 'AA' }])

  it('何も塗っていなければ、レンジに入らないハンドの分だけ一致する', () => {
    expect(matchScore(emptyPainting(gto), gto)).toBeCloseTo(1 - 6 / 1326)
  })

  it('正しく塗れば100%', () => {
    const user = emptyPainting(gto)
    user.set('AA', [1, 0])
    expect(matchScore(user, gto)).toBe(1)
  })

  it('到達しないハンドは採点に含めない', () => {
    const reached = { ...buildStrategy([{ action: raise, range: 'AA' }, { action: call, range: 'KK' }]) }
    reached.weights = new Map([...reached.frequencies.keys()].map((h) => [h, h === 'AA' || h === 'KK' ? 1 : 0]))
    const user = emptyPainting(reached)
    user.set('AA', [1, 0, 0])
    expect(matchScore(user, reached)).toBeCloseTo(0.5)
  })
})

describe('mistakes', () => {
  it('頻度の差が25%以上のハンドを返す', () => {
    const gto = buildStrategy([{ action: raise, range: 'AA, KK:0.5, QQ:0.5' }])
    const user = emptyPainting(gto)
    user.set('KK', [0.75, 0.25])
    user.set('QQ', [0.5, 0.5])
    expect([...mistakes(user, gto)].sort()).toEqual(['AA', 'KK'])
  })
})
