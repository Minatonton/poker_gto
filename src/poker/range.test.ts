import { describe, expect, it } from 'vitest'
import { parseRange } from './range'

const hands = (notation: string) => [...parseRange(notation).keys()].sort()

describe('parseRange', () => {
  it('単一のハンドを指定できる', () => {
    expect(hands('AA, AKs, KQo')).toEqual(['AA', 'AKs', 'KQo'])
  })

  it('スートを省略するとスーテッドとオフスートの両方を含む', () => {
    expect(hands('AK')).toEqual(['AKo', 'AKs'])
  })

  it('ペアの + はそのペア以上のすべてのペアを表す', () => {
    expect(hands('QQ+')).toEqual(['AA', 'KK', 'QQ'])
  })

  it('ペアの範囲指定は両端を含む', () => {
    expect(hands('99-77')).toEqual(['77', '88', '99'])
  })

  it('非ペアの + はハイカードの1つ下までキッカーを上げる', () => {
    expect(hands('KTs+')).toEqual(['KJs', 'KQs', 'KTs'])
    expect(hands('A2o+')).toHaveLength(12)
  })

  it('非ペアの範囲指定は同じハイカードのキッカー範囲を表す', () => {
    expect(hands('A5s-A3s')).toEqual(['A3s', 'A4s', 'A5s'])
  })

  it('頻度を指定しないと1、指定するとその値になる', () => {
    const range = parseRange('AA, KK:0.25')
    expect(range.get('AA')).toBe(1)
    expect(range.get('KK')).toBe(0.25)
  })

  it('同じハンドが重複したら後の指定で上書きする', () => {
    expect(parseRange('64s+, 65s:0.75').get('65s')).toBe(0.75)
  })

  it.each(['AXs', 'KAs', 'AAs', 'A5s-K3s', 'AKs:1.5', 'AKs:abc'])('不正な表記 %s はエラーになる', (notation) => {
    expect(() => parseRange(notation)).toThrow()
  })
})
