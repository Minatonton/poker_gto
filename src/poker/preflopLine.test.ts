import { describe, expect, it } from 'vitest'
import { cash6max100bb } from '../data/cash6max100bb'
import { walkPreflop } from './preflop'
import { choicesForLine, lineOfWalk, type PreflopLine } from './preflopLine'

const walkLine = (line: PreflopLine) => walkPreflop(cash6max100bb, choicesForLine(cash6max100bb, line))
const decisions = (line: PreflopLine) =>
  walkLine(line)
    .steps.filter((s) => s.strategy !== null)
    .map((s) => `${s.position}:${s.action.kind}`)

describe('choicesForLine', () => {
  it('オープナーより前のプレイヤーはフォールドし、オープナーはレイズする', () => {
    expect(decisions({ opener: 'CO' })).toEqual(['UTG:fold', 'HJ:fold', 'CO:raise'])
  })

  it('応答する人が決まっていなければ、オープンの次の判断で止まる', () => {
    const walk = walkLine({ opener: 'CO' })
    expect(walk.status === 'deciding' && walk.position).toBe('BTN')
  })

  it('オープナーと応答する人の間のプレイヤーはフォールドする', () => {
    expect(decisions({ opener: 'HJ', responder: 'BB', response: 'call' })).toEqual([
      'UTG:fold',
      'HJ:raise',
      'CO:fold',
      'BTN:fold',
      'SB:fold',
      'BB:call',
    ])
  })

  it('応答のアクションが決まっていなければ、応答する人の判断で止まる', () => {
    const walk = walkLine({ opener: 'BTN', responder: 'BB' })
    expect(walk.status === 'deciding' && walk.position).toBe('BB')
  })

  it('3ベットされたらオープナーの対応まで進める', () => {
    expect(decisions({ opener: 'CO', responder: 'BTN', response: 'raise', openerReply: 'call' })).toEqual([
      'UTG:fold',
      'HJ:fold',
      'CO:raise',
      'BTN:raise',
      'CO:call',
    ])
  })

  it('何も決まっていなければ最初の判断のまま', () => {
    expect(choicesForLine(cash6max100bb, {})).toEqual([])
  })
})

describe('lineOfWalk', () => {
  it.each<PreflopLine>([
    {},
    { opener: 'UTG' },
    { opener: 'BTN', responder: 'BB', response: 'call' },
    { opener: 'CO', responder: 'SB', response: 'raise', openerReply: 'fold' },
  ])('choicesForLine で作ったラインをそのまま読み戻せる %o', (line) => {
    expect(lineOfWalk(walkLine(line))).toEqual(line)
  })
})
