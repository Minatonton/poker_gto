import { describe, expect, it } from 'vitest'
import { markRead, normalizeReadMarks } from './readProgress'

describe('markRead', () => {
  it('同じ章を二度読み終えても一度と数える', () => {
    expect(markRead(markRead([], 'ev-eq'), 'ev-eq')).toEqual(['ev-eq'])
  })
})

describe('normalizeReadMarks', () => {
  it('今はない章の id や、配列でない値は捨てる', () => {
    expect(normalizeReadMarks(['outs', 'removed'], ['ev-eq', 'outs'])).toEqual(['outs'])
    expect(normalizeReadMarks('broken', ['ev-eq'])).toEqual([])
  })
})
