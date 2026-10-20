import { describe, expect, it } from 'vitest'
import { cardToId } from './cards'
import { categoryOf, evaluate } from './evaluator'

const value = (cards: string) => evaluate(cards.split(' ').map(cardToId))
const category = (cards: string) => categoryOf(value(cards))

describe('役の判定', () => {
  it.each([
    ['As Ks Qs Js Ts 2d 3c', 'ストレートフラッシュ'],
    ['9c 9d 9h 9s Ks 2d 3c', 'フォーカード'],
    ['9c 9d 9h Ks Kd 2d 3c', 'フルハウス'],
    ['9c 9d 9h Ks Kd Kc 3c', 'フルハウス'],
    ['As 9s 7s 4s 2s Kd 3c', 'フラッシュ'],
    ['9c Td Jh Qs Kd 2d 3c', 'ストレート'],
    ['Ac 2d 3h 4s 5d Kd Kc', 'ストレート'],
    ['9c 9d 9h Ks 2d 3c 5h', 'スリーカード'],
    ['9c 9d Kh Ks 2d 3c 5h', 'ツーペア'],
    ['9c 9d Kh Qs 2d 3c 5h', 'ワンペア'],
    ['9c 8d Kh Qs 2d 3c 5h', 'ハイカード'],
  ])('%s は %s', (cards, expected) => {
    expect(category(cards)).toBe(expected)
  })
})

describe('同じ役の強さ比べ', () => {
  it('より上のストレートが勝ち、ホイールは6ハイのストレートに負ける', () => {
    expect(value('Ac 2d 3h 4s 5d')).toBeLessThan(value('2c 3d 4h 5s 6d'))
  })

  it('ワンペア同士はキッカーで比べる', () => {
    expect(value('Ac Ad Kh 7s 2d')).toBeGreaterThan(value('Ac Ad Qh Js Td'))
  })

  it('ボードの5枚が一番強ければ引き分けになる', () => {
    expect(value('As Ks Qs Js Ts 2d 3c')).toBe(value('As Ks Qs Js Ts 4d 4c'))
  })

  it('ツーペアが3組あるときは上の2組とキッカーで比べる', () => {
    expect(value('Ac Ad Kh Ks 2d 2c 7h')).toBeLessThan(value('Ac Ad Kh Ks 2d 2c Qh'))
  })
})
