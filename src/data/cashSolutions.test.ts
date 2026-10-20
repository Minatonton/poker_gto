import { describe, expect, it } from 'vitest'
import { spotFromWalk } from '../poker/postflopSpot'
import { walkPreflop } from '../poker/preflop'
import { choicesForLine } from '../poker/preflopLine'
import { overallFrequencies } from '../poker/strategy'
import { createPreflopQuestion, PREFLOP_DRILLS } from '../trainer/preflopDrill'
import { cashSolution, MAX_PLAYERS, MIN_PLAYERS } from './cashSolutions'

const sizes = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i)

describe('cashSolution', () => {
  it.each(sizes)('%i人卓は、その人数の席を持つ', (players) => {
    expect(cashSolution(players).positions).toHaveLength(players)
  })

  it.each(sizes)('%i人卓では、どの出題も頻度の合計が1を超えずに作れる', (players) => {
    const solution = cashSolution(players)
    for (const { kind } of PREFLOP_DRILLS) {
      for (let i = 0; i < 10; i++) expect(() => createPreflopQuestion(solution, kind, null)).not.toThrow()
    }
  })

  it('人数が多いほど、最初の席のオープンレンジは狭い', () => {
    const openRate = (players: number) => {
      const walk = walkPreflop(cashSolution(players), [])
      if (walk.status !== 'deciding') throw new Error('判断ノードに到達していません')
      return overallFrequencies(walk.strategy)[0]
    }
    const rates = [9, 8, 7, 6, 5, 4, 3].map(openRate)
    expect(rates).toEqual([...rates].sort((a, b) => a - b))
  })

  it('ヘッズアップでは SB がオープンし、ポストフロップでは BB が先に行動する', () => {
    const solution = cashSolution(2)
    const walk = walkPreflop(solution, choicesForLine(solution, { opener: 'SB', responder: 'BB', response: 'call' }))
    const spot = spotFromWalk(walk)!
    expect(spot.oop).toBe('BB')
    expect(spot.ip).toBe('SB')
    expect(spot.potBb).toBe(5)
  })

  it('9人卓では UTG+1 のオープンに LJ が応じられる', () => {
    const solution = cashSolution(9)
    const walk = walkPreflop(solution, choicesForLine(solution, { opener: 'UTG+1', responder: 'LJ' }))
    expect(walk.status === 'deciding' && walk.position).toBe('LJ')
  })
})
