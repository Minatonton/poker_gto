import { describe, expect, it } from 'vitest'
import { POSITIONS, walkPreflop, type Position } from '../poker/preflop'
import { overallFrequencies } from '../poker/strategy'
import { cash6max100bb } from './cash6max100bb'

describe('Cash 6-max 100bb のプリフロップデータ', () => {
  it('BB以外の全ポジションにオープンレンジがある', () => {
    expect(Object.keys(cash6max100bb.rfi)).toEqual(POSITIONS.slice(0, -1))
  })

  it('オープンレンジは後ろのポジションほど広い', () => {
    const openRates = POSITIONS.slice(0, 4).map((_, index) => {
      const walk = walkPreflop(cash6max100bb, Array(index).fill('fold'))
      if (walk.status !== 'deciding') throw new Error('判断ノードに到達していません')
      return overallFrequencies(walk.strategy)[0]
    })
    expect(openRates).toEqual([...openRates].sort((a, b) => a - b))
  })

  it('すべてのオープン・3ベット・4ベットの判断ノードで頻度の合計が1を超えない', () => {
    const openerChoices = (index: number) => [...Array(index).fill('fold'), 'raise']
    for (let opener = 0; opener < 5; opener++) {
      for (let responder = opener + 1; responder < 6; responder++) {
        const folds = Array(responder - opener - 1).fill('fold')
        expect(() => walkPreflop(cash6max100bb, [...openerChoices(opener), ...folds, 'raise'])).not.toThrow()
      }
    }
  })

  it('3ベットされたすべてのラインでオープナーの応答データがある', () => {
    for (const [opener, responders] of Object.entries(cash6max100bb.vsOpen)) {
      for (const threeBettor of Object.keys(responders ?? {})) {
        expect(cash6max100bb.vs3bet[opener as Position]?.[threeBettor as Position]).toBeDefined()
      }
    }
  })
})
