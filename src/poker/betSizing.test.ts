import { describe, expect, it } from 'vitest'
import { isGtoSize, preflopSizeChoices } from './betSizing'

describe('preflopSizeChoices', () => {
  it('オープンでは 2〜4bb を並べ、GTO の額が候補になければ足す', () => {
    expect(preflopSizeChoices(2.5, 1)).toEqual([2, 2.5, 3, 4])
    expect(preflopSizeChoices(2.25, 1)).toEqual([2, 2.25, 2.5, 3, 4])
  })

  it('レイズを受けたら、その額の 2.5〜5 倍を 0.5bb 刻みで並べる', () => {
    expect(preflopSizeChoices(7.5, 2.5)).toEqual([6.5, 7.5, 10, 12.5])
  })

  it('GTO の額が倍率の候補と重ならなくても、必ず含める', () => {
    expect(preflopSizeChoices(11, 2.5)).toContain(11)
  })
})

describe('isGtoSize', () => {
  it('同じ額だけを GTO の額とみなす', () => {
    expect(isGtoSize(2.5, 2.5)).toBe(true)
    expect(isGtoSize(3, 2.5)).toBe(false)
  })
})
