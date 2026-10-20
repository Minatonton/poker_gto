import { describe, expect, it } from 'vitest'
import { walkPreflop, type PreflopSolution } from './preflop'

const solution: PreflopSolution = {
  name: 'test',
  rfi: {
    UTG: { raiseTo: 2.5, raise: 'AA' },
    BTN: { raiseTo: 2.5, raise: 'AA, KK' },
  },
  vsOpen: {
    UTG: { BB: { raiseTo: 11, raise: 'AA', call: 'KK' } },
    BTN: { BB: { raiseTo: 11, raise: 'AA', call: 'KK' } },
  },
  vs3bet: {
    BTN: { BB: { raiseTo: 24, raise: 'AA', call: 'KK' } },
  },
}

const positions = (walk: ReturnType<typeof walkPreflop>) => walk.steps.map((s) => `${s.position}:${s.action.kind}`)

describe('walkPreflop', () => {
  it('最初はUTGのオープン判断から始まる', () => {
    const walk = walkPreflop(solution, [])
    expect(walk.status).toBe('deciding')
    if (walk.status === 'deciding') expect(walk.position).toBe('UTG')
  })

  it('データのないポジションは自動でフォールドして次の判断へ進む', () => {
    const walk = walkPreflop(solution, ['fold'])
    expect(positions(walk)).toEqual(['UTG:fold', 'HJ:fold', 'CO:fold'])
    expect(walk.steps.filter((s) => s.strategy === null).map((s) => s.position)).toEqual(['HJ', 'CO'])
    if (walk.status === 'deciding') expect(walk.position).toBe('BTN')
  })

  it('オープンに対して後ろのプレイヤーが順に判断する', () => {
    const walk = walkPreflop(solution, ['fold', 'raise'])
    expect(walk.status === 'deciding' && walk.position).toBe('BB')
  })

  it('3ベットされるとオープナーが応答する', () => {
    const walk = walkPreflop(solution, ['fold', 'raise', 'raise'])
    expect(walk.status === 'deciding' && walk.position).toBe('BTN')
    if (walk.status === 'deciding') expect(walk.strategy.actions[0].label).toBe('4Bet 24bb')
  })

  it('コールするとフロップへ進んで終了する', () => {
    const walk = walkPreflop(solution, ['fold', 'raise', 'call'])
    expect(walk.status).toBe('finished')
  })

  it('全員フォールドするとBBがポットを獲得する', () => {
    const walk = walkPreflop(solution, ['fold', 'fold'])
    expect(walk.status === 'finished' && walk.result).toContain('BB がポットを獲得')
  })

  it('3ベットへの応答データがなければ終了する', () => {
    const walk = walkPreflop(solution, ['raise', 'raise'])
    expect(walk.status === 'finished' && walk.result).toContain('未収録')
  })

  it('2回目の判断では、1回目に選んだアクションの頻度がそのハンドの重みになる', () => {
    const walk = walkPreflop(
      { ...solution, rfi: { BTN: { raiseTo: 2.5, raise: 'AA, KK:0.5' } } },
      ['raise', 'raise'],
    )
    if (walk.status !== 'deciding') throw new Error('判断ノードに到達していません')
    expect(walk.strategy.weights?.get('AA')).toBe(1)
    expect(walk.strategy.weights?.get('KK')).toBe(0.5)
    expect(walk.strategy.weights?.get('72o')).toBe(0)
  })

  it('選べないアクションを指定するとエラーになる', () => {
    expect(() => walkPreflop(solution, ['call'])).toThrow()
  })
})
