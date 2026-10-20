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

  it('コールの後ろで誰も応じなければ、残りはフォールドしてヘッズアップでフロップへ進む', () => {
    const walk = walkLine({ opener: 'CO', responder: 'BTN', response: 'call' })
    expect(walk.status === 'finished' && walk.flopPlayers).toEqual(['CO', 'BTN'])
  })

  it('コールの後ろでさらに応じる人を選ぶと、その人の判断で止まる', () => {
    const walk = walkLine({ opener: 'CO', responder: 'BTN', response: 'call', overcaller: 'BB' })
    expect(walk.status === 'deciding' && walk.position).toBe('BB')
    if (walk.status === 'deciding') expect(walk.strategy.actions[0].label).toBe('Squeeze 12.5bb')
  })

  it('オーバーコールすると3人でフロップへ進む', () => {
    const walk = walkLine({ opener: 'CO', responder: 'BTN', response: 'call', overcaller: 'BB', overcallAction: 'call' })
    expect(walk.status === 'finished' && walk.flopPlayers).toEqual(['CO', 'BTN', 'BB'])
  })

  it('スクイーズされると、オープナー、コールした人の順に対応する', () => {
    const line: PreflopLine = {
      opener: 'CO',
      responder: 'BTN',
      response: 'call',
      overcaller: 'BB',
      overcallAction: 'raise',
      openerReply: 'fold',
    }
    const walk = walkLine(line)
    expect(walk.status === 'deciding' && walk.position).toBe('BTN')
    const finished = walkLine({ ...line, callerReply: 'call' })
    expect(finished.status === 'finished' && finished.flopPlayers).toEqual(['BTN', 'BB'])
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
    { opener: 'HJ', responder: 'CO', response: 'call', overcaller: 'BB', overcallAction: 'call' },
    {
      opener: 'CO',
      responder: 'BTN',
      response: 'call',
      overcaller: 'SB',
      overcallAction: 'raise',
      openerReply: 'call',
      callerReply: 'fold',
    },
  ])('choicesForLine で作ったラインをそのまま読み戻せる %o', (line) => {
    expect(lineOfWalk(walkLine(line))).toEqual(line)
  })
})
