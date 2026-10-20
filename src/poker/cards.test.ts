import { describe, expect, it } from 'vitest'
import { cardFromId, cardToId, displayBoard, handClassOf, parseBoard, randomFlop } from './cards'

describe('カード番号', () => {
  it('postflop-solver と同じく 2c が0、As が51になる', () => {
    expect(cardToId('2c')).toBe(0)
    expect(cardToId('As')).toBe(51)
    expect(cardFromId(cardToId('Td'))).toBe('Td')
  })
})

describe('parseBoard', () => {
  it('空白の有無や大文字小文字を問わずに解釈する', () => {
    expect(parseBoard('as kD 7c')).toEqual(['As', 'Kd', '7c'])
    expect(parseBoard('AsKd7c2h')).toEqual(['As', 'Kd', '7c', '2h'])
  })

  it.each(['AsKd', 'AsKd7c2h3h4h', 'AsAs7c', 'XsKd7c'])('不正なボード %s はエラーになる', (board) => {
    expect(() => parseBoard(board)).toThrow()
  })
})

describe('randomFlop', () => {
  it('重複のない3枚を返す', () => {
    const flop = randomFlop()
    expect(new Set(flop).size).toBe(3)
  })
})

describe('handClassOf', () => {
  it('ホールカードの並び順によらずハンドクラスを返す', () => {
    expect(handClassOf('KsAs')).toBe('AKs')
    expect(handClassOf('AsKd')).toBe('AKo')
    expect(handClassOf('7c7d')).toBe('77')
  })
})

describe('displayBoard', () => {
  it('フロップは強い順に並べ、ターンとリバーは配られた順に続ける', () => {
    expect(displayBoard(['2c', '7s', 'Kd', '3h', 'Ah'])).toEqual(['Kd', '7s', '2c', '3h', 'Ah'])
  })
})
