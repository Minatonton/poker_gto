import { describe, expect, it } from 'vitest'
import { cash6max100bb } from '../data/cash6max100bb'
import { walkPreflop } from './preflop'
import { choicesForLine } from './preflopLine'
import { seatsFromBottom, tableState } from './table'

const stateOf = (line: Parameters<typeof choicesForLine>[1]) =>
  tableState(walkPreflop(cash6max100bb, choicesForLine(cash6max100bb, line)).steps)

describe('tableState', () => {
  it('最初はブラインドだけがポットにある', () => {
    const state = tableState([])
    expect(state.pot).toBe(1.5)
    expect(state.seats.SB.stack).toBe(99.5)
    expect(state.seats.BB.invested).toBe(1)
  })

  it('オープンとコールの額が各席から出て、ポットに入る', () => {
    const state = stateOf({ opener: 'CO', responder: 'BTN', response: 'call' })
    expect(state.seats.CO.invested).toBe(2.5)
    expect(state.seats.BTN.stack).toBe(97.5)
    expect(state.pot).toBe(2.5 + 2.5 + 0.5 + 1)
  })

  it('フォールドした席と、データがなく自動でフォールドした席を区別する', () => {
    const state = stateOf({ opener: 'CO', responder: 'BTN', response: 'call' })
    expect(state.seats.UTG.folded).toBe(true)
    expect(state.seats.UTG.autoFolded).toBe(false)
    expect(state.seats.CO.folded).toBe(false)
  })

  it('3ベットにコールすると、コールした額が3ベットの額になる', () => {
    const state = stateOf({ opener: 'CO', responder: 'BTN', response: 'raise', openerReply: 'call' })
    expect(state.seats.CO.invested).toBe(7.5)
    expect(state.currentBet).toBe(7.5)
  })
})

describe('seatsFromBottom', () => {
  it('指定した席から時計回りに並べる', () => {
    expect(seatsFromBottom('BTN')).toEqual(['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'])
  })
})
