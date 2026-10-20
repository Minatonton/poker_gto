import { describe, expect, it } from 'vitest'
import { cardToId } from './cards'
import { classifyHand } from './handCategory'

const classify = (hole: string, board: string) => {
  const [a, b] = hole.split(' ').map(cardToId)
  return classifyHand([a, b], board.split(' ').map(cardToId))
}

describe('役の分類', () => {
  it.each([
    ['Ah Kh', 'Kd 7c 2s', 'トップペア'],
    ['Ah Ad', 'Kd 7c 2s', 'オーバーペア'],
    ['7h 7d', 'Kd 7c 2s', 'セット・トリップス'],
    ['Kh 7h', 'Kd 7c 2s', 'ツーペア'],
    ['Qh 7h', 'Kd 7c 2s', 'セカンドペア'],
    ['3h 3d', 'Kd 7c 2s', '弱いペア'],
    ['Ah Qd', 'Kd 7c 2s', 'Aハイ'],
    ['Qh Jd', 'Kd 7c 2s', 'ハイカード'],
    ['Th 9h', '8h 7c 6s', 'ストレート'],
    ['Ah 2h', 'Kh 7h 9h', 'フラッシュ以上'],
  ])('%s on %s は %s', (hole, board, expected) => {
    expect(classify(hole, board).made).toBe(expected)
  })

  it('ボードだけでスリーカードができていても、手札が関わらなければセットにしない', () => {
    expect(classify('Ah Qd', '7c 7d 7s').made).toBe('Aハイ')
  })

  it('ボードのペアと自分のペアでできたツーペアは、自分のペアとして扱う', () => {
    expect(classify('Ah Kd', 'Kc 7d 7s').made).toBe('トップペア')
  })
})

describe('ドロー', () => {
  it('同じスートが4枚で、Aを持っていればナッツフラッシュドロー', () => {
    expect(classify('Ah 5h', 'Kh 9h 2c').draws).toContain('ナッツフラッシュドロー')
    expect(classify('Qh 5h', 'Kh 9h 2c').draws).toContain('フラッシュドロー')
  })

  it('両側が開いたストレートドローはオープンエンド、片側だけならガットショット', () => {
    expect(classify('9h 8d', 'Tc 7s 2h').draws).toContain('オープンエンド')
    expect(classify('9h 6d', 'Tc 7s 2h').draws).toContain('ガットショット')
  })

  it('フロップで手札2枚とボード1枚が同じスートならバックドアフラッシュ', () => {
    expect(classify('Ah 5h', 'Kh 9c 2d').draws).toContain('バックドアフラッシュ')
  })

  it('リバーにはドローがない', () => {
    expect(classify('Ah 5h', 'Kh 9h 2c 3d 7s').draws).toEqual([])
  })
})

describe('EQ の崩れにくさ', () => {
  it('セットやナッツフラッシュドローは Robust', () => {
    expect(classify('7h 7d', 'Kd 7c 2s').robustness).toBe('robust')
    expect(classify('Ah 5h', 'Kh 9h 2c').robustness).toBe('robust')
  })

  it('弱いペアや A ハイは Vulnerable', () => {
    expect(classify('3h 3d', 'Kd 7c 2s').robustness).toBe('vulnerable')
    expect(classify('Ah Qd', 'Kd 7c 2s').robustness).toBe('vulnerable')
  })

  it('トップペアは中間', () => {
    expect(classify('Ah Kh', 'Kd 7c 2s').robustness).toBe('middle')
  })
})
