import { describe, expect, it } from 'vitest'
import { actionForRng, gradeByEv, gradeByFrequency } from './grading'

describe('gradeByFrequency', () => {
  it('最も頻度の高いアクションは Best', () => {
    expect(gradeByFrequency([0.7, 0.3], 0)).toBe('best')
  })

  it('25%以上選ばれるアクションは Correct', () => {
    expect(gradeByFrequency([0.7, 0.3], 1)).toBe('correct')
  })

  it('まれにしか選ばれないアクションは Inaccuracy、ほぼ選ばれないアクションは Wrong', () => {
    expect(gradeByFrequency([0.9, 0.1], 1)).toBe('inaccuracy')
    expect(gradeByFrequency([0.99, 0.01], 1)).toBe('wrong')
  })

  it('RNG を使うと、出目が入る区間のアクションだけが Best になる', () => {
    expect(gradeByFrequency([0.7, 0.3], 1, 0.8)).toBe('best')
    expect(gradeByFrequency([0.7, 0.3], 0, 0.8)).toBe('correct')
  })
})

describe('actionForRng', () => {
  it('頻度を並び順に区間へ割り当てる', () => {
    expect(actionForRng([0.2, 0.5, 0.3], 0.1)).toBe(0)
    expect(actionForRng([0.2, 0.5, 0.3], 0.6)).toBe(1)
    expect(actionForRng([0.2, 0.5, 0.3], 0.95)).toBe(2)
  })
})

describe('gradeByEv', () => {
  const frequencies = [0.98, 0.01, 0.01]

  it('EV の損失がポットの1%以内なら Correct', () => {
    expect(gradeByEv(frequencies, [10, 9.95, 0], 1, 10).grade).toBe('correct')
  })

  it('損失が大きくなるほど Inaccuracy、Wrong、Blunder になる', () => {
    expect(gradeByEv(frequencies, [10, 9.8, 0], 1, 10).grade).toBe('inaccuracy')
    expect(gradeByEv(frequencies, [10, 9.5, 0], 1, 10).grade).toBe('wrong')
    expect(gradeByEv(frequencies, [10, 9, 0], 2, 10).grade).toBe('blunder')
  })

  it('GTO がそれなりの頻度で選ぶアクションは、EV の誤差が大きくても頻度の評価を下回らない', () => {
    expect(gradeByEv([0.6, 0.4], [10, 9], 1, 10).grade).toBe('correct')
  })

  it('EV の損失を返す', () => {
    expect(gradeByEv(frequencies, [10, 9, 0], 2, 10).evLoss).toBe(10)
  })
})
