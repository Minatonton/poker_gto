import { describe, expect, it } from 'vitest'
import { ALL_HANDS, HAND_GRID, TOTAL_COMBOS, comboCount } from './hands'

describe('ハンドグリッド', () => {
  it('169種類のハンドを重複なく持つ', () => {
    expect(new Set(ALL_HANDS).size).toBe(169)
  })

  it('対角はペア、右上はスーテッド、左下はオフスートになる', () => {
    expect(HAND_GRID[0][0]).toBe('AA')
    expect(HAND_GRID[0][1]).toBe('AKs')
    expect(HAND_GRID[1][0]).toBe('AKo')
    expect(HAND_GRID[12][12]).toBe('22')
    expect(HAND_GRID[11][12]).toBe('32s')
  })
})

describe('コンボ数', () => {
  it('ペアは6、スーテッドは4、オフスートは12', () => {
    expect(comboCount('AA')).toBe(6)
    expect(comboCount('AKs')).toBe(4)
    expect(comboCount('AKo')).toBe(12)
  })

  it('全ハンドの合計は1326になる', () => {
    expect(ALL_HANDS.reduce((sum, h) => sum + comboCount(h), 0)).toBe(TOTAL_COMBOS)
  })
})
