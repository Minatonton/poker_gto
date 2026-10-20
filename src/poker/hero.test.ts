import { describe, expect, it } from 'vitest'
import { heroHandFor, parseHero } from './hero'

describe('parseHero', () => {
  it('手札からハンドクラスを求める', () => {
    const hero = parseHero({ position: 'BTN', cardsText: 'kh ah' })
    expect(hero.cards).toEqual(['Kh', 'Ah'])
    expect(hero.handClass).toBe('AKs')
    expect(hero.error).toBe('')
  })

  it('手札が空ならエラーにせず未入力として扱う', () => {
    expect(parseHero({ position: null, cardsText: ' ' })).toMatchObject({ cards: null, error: '' })
  })

  it('解釈できない手札はエラーを返す', () => {
    expect(parseHero({ position: null, cardsText: 'AKs' }).error).not.toBe('')
  })
})

describe('heroHandFor', () => {
  const hero = parseHero({ position: 'BB', cardsText: '9h8h' })

  it('自分の手番なら自分のハンドを返す', () => {
    expect(heroHandFor(hero, 'BB')).toBe('98s')
  })

  it('相手の手番なら返さない', () => {
    expect(heroHandFor(hero, 'CO')).toBeNull()
  })
})
