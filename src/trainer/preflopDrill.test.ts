import { describe, expect, it } from 'vitest'
import { cash6max100bb } from '../data/cash6max100bb'
import { POSITIONS } from '../poker/preflop'
import { createPreflopQuestion, PREFLOP_DRILLS } from './preflopDrill'

describe('createPreflopQuestion', () => {
  it.each(PREFLOP_DRILLS.map((d) => d.kind))('%s の問題は手番のプレイヤーの判断で止まる', (kind) => {
    for (let i = 0; i < 20; i++) {
      const question = createPreflopQuestion(cash6max100bb, kind, null)
      expect(question?.walk.status).toBe('deciding')
    }
  })

  it('席を指定すると、その席が手番になる', () => {
    const question = createPreflopQuestion(cash6max100bb, 'vsOpen', 'BB')
    expect(question?.walk.position).toBe('BB')
  })

  it('3ベットへの対応では、オープンしたハンドだけが配られる', () => {
    for (let i = 0; i < 50; i++) {
      const question = createPreflopQuestion(cash6max100bb, 'vs3bet', 'UTG')!
      expect(question.walk.strategy.weights?.get(question.hand)).toBeGreaterThan(0)
    }
  })

  it('その席に手番が来ない組み合わせは null', () => {
    expect(createPreflopQuestion(cash6max100bb, 'vsOpen', 'UTG')).toBeNull()
    expect(createPreflopQuestion(cash6max100bb, 'rfi', 'BB')).toBeNull()
  })

  it('オープンの問題はどの席からでも作れる', () => {
    for (const position of POSITIONS.slice(0, 5)) {
      expect(createPreflopQuestion(cash6max100bb, 'rfi', position)?.walk.position).toBe(position)
    }
  })
})
