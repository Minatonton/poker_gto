import { describe, expect, it } from 'vitest'
import { spotFromWalk, toRangeNotation } from './postflopSpot'
import { cash6max100bb } from '../data/cash6max100bb'
import { POSITIONS, walkPreflop, type PreflopSolution } from './preflop'
import { choicesForLine } from './preflopLine'

const solution: PreflopSolution = {
  name: 'test',
  positions: POSITIONS,
  rfi: { BTN: { raiseTo: 2.5, raise: 'AA, KK, QQ:0.5, 72o' } },
  vsOpen: { BTN: { BB: { raiseTo: 11, raise: 'AA', call: 'KK, QQ, AKs' } } },
  vs3bet: { BTN: { BB: { raiseTo: 24, raise: 'KK', call: 'AA, QQ' } } },
}

const btnOpenBbCall = walkPreflop(solution, ['raise', 'call'])
const btnOpenBb3betBtnCall = walkPreflop(solution, ['raise', 'raise', 'call'])

describe('spotFromWalk', () => {
  it('ポストフロップで先に行動するプレイヤーがOOPになる', () => {
    const spot = spotFromWalk(btnOpenBbCall)!
    expect(spot.oop).toBe('BB')
    expect(spot.ip).toBe('BTN')
  })

  it('シングルレイズドポットではオープン額同士にSBのデッドマネーが加わる', () => {
    const spot = spotFromWalk(btnOpenBbCall)!
    expect(spot.potBb).toBe(5.5)
    expect(spot.effectiveStackBb).toBe(97.5)
    expect(spot.name).toContain('シングルレイズドポット')
  })

  it('3ベットポットでは3ベット額同士にSBのデッドマネーが加わる', () => {
    const spot = spotFromWalk(btnOpenBb3betBtnCall)!
    expect(spot.potBb).toBe(22.5)
    expect(spot.effectiveStackBb).toBe(89)
    expect(spot.name).toContain('3ベットポット')
  })

  it('レンジは各判断で選ばれたアクションの頻度の積になる', () => {
    const spot = spotFromWalk(btnOpenBbCall)!
    expect(spot.ipRange.get('QQ')).toBe(0.5)
    expect(spot.ipRange.get('72o')).toBe(1)
    expect(spot.ipRange.get('AKs')).toBe(0)
    expect(spot.oopRange.get('KK')).toBe(1)
    expect(spot.oopRange.get('AA')).toBe(0)
  })

  it('3ベットポットではオープンと3ベットへのコールの両方の頻度を掛け合わせる', () => {
    const spot = spotFromWalk(btnOpenBb3betBtnCall)!
    expect(spot.ipRange.get('QQ')).toBe(0.5)
    expect(spot.ipRange.get('KK')).toBe(0)
    expect(spot.oopRange.get('AA')).toBe(1)
  })

  it('スクイーズポットでは、降りたオープナーのチップもデッドマネーとしてポットに入る', () => {
    const spot = spotFromWalk(
      walkPreflop(cash6max100bb, choicesForLine(cash6max100bb, {
        opener: 'CO',
        responder: 'BTN',
        response: 'call',
        overcaller: 'BB',
        overcallAction: 'raise',
        openerReply: 'fold',
        callerReply: 'call',
      })),
    )!
    expect(spot.oop).toBe('BB')
    expect(spot.ip).toBe('BTN')
    expect(spot.potBb).toBe(2.5 + 12.5 + 12.5 + 0.5)
  })

  it('3人でフロップに進むラインではスポットを作らない', () => {
    const walk = walkPreflop(
      cash6max100bb,
      choicesForLine(cash6max100bb, { opener: 'CO', responder: 'BTN', response: 'call', overcaller: 'BB', overcallAction: 'call' }),
    )
    expect(spotFromWalk(walk)).toBeNull()
  })

  it('フロップに進まないラインではスポットを作らない', () => {
    expect(spotFromWalk(walkPreflop(solution, ['raise', 'fold']))).toBeNull()
    expect(spotFromWalk(walkPreflop(solution, ['fold']))).toBeNull()
  })
})

describe('toRangeNotation', () => {
  it('頻度0のハンドを除き、1未満の頻度だけを付ける', () => {
    const range = new Map([
      ['AA', 1],
      ['KK', 0.25],
      ['QQ', 0],
    ])
    expect(toRangeNotation(range)).toBe('AA,KK:0.25')
  })
})
