import { describe, expect, it } from 'vitest'
import { cash6max100bb } from '../data/cash6max100bb'
import { preflopMatchup } from './matchup'
import { POSITIONS, walkPreflop } from './preflop'
import { choicesForLine } from './preflopLine'

const stepsOf = (line: Parameters<typeof choicesForLine>[1]) =>
  walkPreflop(cash6max100bb, choicesForLine(cash6max100bb, line)).steps

describe('preflopMatchup', () => {
  it('オープンを受けたら、相手はオープンした人で、コール額はオープン額からすでに出した分を引いた額', () => {
    const steps = walkPreflop(cash6max100bb, ['raise', 'fold', 'fold', 'fold', 'fold']).steps
    const matchup = preflopMatchup(steps, POSITIONS, 'BB')!
    expect(matchup.opponent).toBe('UTG')
    expect(matchup.toCall).toBe(1.5)
    expect(matchup.pot).toBe(2.5 + 0.5 + 1)
  })

  it('相手のレンジは、オープンした人がオープンに選ぶハンドだけになる', () => {
    const steps = walkPreflop(cash6max100bb, ['raise', 'fold', 'fold', 'fold', 'fold']).steps
    const range = preflopMatchup(steps, POSITIONS, 'BB')!.range
    expect(range.get('AA')).toBeGreaterThan(0)
    expect(range.get('72o')).toBe(0)
  })

  it('3ベットを受けたオープナーの相手は、3ベットした人', () => {
    const steps = stepsOf({ opener: 'CO', responder: 'BTN', response: 'raise' })
    expect(preflopMatchup(steps, POSITIONS, 'CO')?.opponent).toBe('BTN')
  })

  it('誰もレイズしていなければ相手は決まらず、どの手も同じ重みのレンジと比べる', () => {
    const matchup = preflopMatchup([], POSITIONS, 'UTG')!
    expect(matchup.opponent).toBeNull()
    expect(matchup.range.get('72o')).toBe(1)
  })

  it('フォールドした席には出さない', () => {
    const steps = walkPreflop(cash6max100bb, ['fold']).steps
    expect(preflopMatchup(steps, POSITIONS, 'UTG')).toBeNull()
  })
})
