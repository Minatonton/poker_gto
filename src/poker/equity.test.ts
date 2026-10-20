import { describe, expect, it } from 'vitest'
import { cardToId } from './cards'
import { combosOf, equityVsRange } from './equity'
import { parseRange } from './range'

const ids = (cards: string) => cards.split(' ').map(cardToId)
const hole = (cards: string) => ids(cards) as [number, number]

describe('combosOf', () => {
  it('ペアは6、スーテッドは4、オフスートは12通り', () => {
    expect(combosOf('AA', new Set())).toHaveLength(6)
    expect(combosOf('AKs', new Set())).toHaveLength(4)
    expect(combosOf('AKo', new Set())).toHaveLength(12)
  })

  it('取り除かれたカードを含む組は作らない', () => {
    expect(combosOf('AA', new Set([cardToId('As')]))).toHaveLength(3)
  })
})

describe('equityVsRange', () => {
  it('プリフロップの AA は KK に対して約82%', () => {
    const result = equityVsRange(hole('As Ah'), [], parseRange('KK'), 20000)
    expect(result.equity).toBeCloseTo(0.82, 1)
  })

  it('リバーでナッツなら勝率100%', () => {
    const result = equityVsRange(hole('As Ks'), ids('Qs Js Ts 2d 3c'), parseRange('AA, KK, 22'), 500)
    expect(result.equity).toBe(1)
  })

  it('同じ2枚どうしで同じボードなら必ず引き分け', () => {
    const result = equityVsRange(hole('As Kd'), ids('2c 7h 9s Jd 4c'), parseRange('AKo'), 500)
    expect(result.tie).toBe(1)
  })

  it('相手のレンジがすべて手札と重なるとエラーになる', () => {
    expect(() => equityVsRange(hole('As Ah'), ids('Ad Ac 2s'), parseRange('AA'))).toThrow()
  })
})
