import { describe, expect, it } from 'vitest'
import { boardTexture, REPRESENTATIVE_FLOPS } from './texture'

describe('boardTexture', () => {
  it('スートの数でモノトーン・ツートーン・レインボーに分ける', () => {
    expect(boardTexture(['As', 'Js', '9s']).suits).toBe('モノトーン')
    expect(boardTexture(['Ah', 'Qh', '6d']).suits).toBe('ツートーン')
    expect(boardTexture(['As', '7d', '2c']).suits).toBe('レインボー')
  })

  it('同じランクが2枚以上あればペアボード', () => {
    expect(boardTexture(['Kd', 'Kc', '7h']).paired).toBe(true)
    expect(boardTexture(['Kd', 'Qc', '7h']).paired).toBe(false)
  })

  it('3枚がストレートを作れる範囲に並んでいればつながりがある', () => {
    expect(boardTexture(['8s', '7d', '5c']).connected).toBe(true)
    expect(boardTexture(['Kh', '8d', '3c']).connected).toBe(false)
    expect(boardTexture(['Ah', '4d', '3c']).connected).toBe(true)
  })

  it('最も高いカードのランクを返す', () => {
    expect(boardTexture(['7h', 'Kd', '2c']).highCard).toBe('K')
  })
})

describe('REPRESENTATIVE_FLOPS', () => {
  it('どのフロップも3枚の異なるカード', () => {
    for (const flop of REPRESENTATIVE_FLOPS) expect(new Set(flop).size).toBe(3)
  })

  it('モノトーン・ペア・つながりのあるボードをそれぞれ含む', () => {
    const textures = REPRESENTATIVE_FLOPS.map(boardTexture)
    expect(textures.some((t) => t.suits === 'モノトーン')).toBe(true)
    expect(textures.some((t) => t.paired)).toBe(true)
    expect(textures.some((t) => t.connected)).toBe(true)
  })
})
