import { describe, expect, it } from 'vitest'
import { cash6max100bb } from '../data/cash6max100bb'
import {
  addMistake,
  MAX_MISTAKES,
  normalizeMistakes,
  questionFromMistake,
  removeMistake,
  type Mistake,
} from './mistakes'

const mistake = (hand: string, choices: Mistake['choices'] = []): Mistake => ({
  players: 6,
  choices,
  hand,
  cards: ['As', 'Kd'],
})

describe('addMistake', () => {
  it('最後に間違えたものを先頭に置き、同じ場面・同じハンドは1つにまとめる', () => {
    const list = addMistake(addMistake(addMistake([], mistake('AKo')), mistake('QJs')), mistake('AKo'))
    expect(list.map((m) => m.hand)).toEqual(['AKo', 'QJs'])
  })

  it('上限を超えたら古いものから捨てる', () => {
    let list: Mistake[] = []
    for (let i = 0; i <= MAX_MISTAKES; i++) list = addMistake(list, mistake(`h${i}`))
    expect(list).toHaveLength(MAX_MISTAKES)
    expect(list.at(-1)?.hand).toBe('h1')
  })
})

describe('removeMistake', () => {
  it('復習で正解した問題は外れる', () => {
    expect(removeMistake([mistake('AKo'), mistake('QJs')], mistake('AKo')).map((m) => m.hand)).toEqual(['QJs'])
  })
})

describe('questionFromMistake', () => {
  it('同じ場面の手番まで進め直し、間違えたときの手札で出す', () => {
    const question = questionFromMistake(cash6max100bb, mistake('AKo', ['fold']))
    expect(question?.walk.position).toBe('HJ')
    expect(question?.cards).toEqual(['As', 'Kd'])
  })

  it('卓の人数が違えば出さない', () => {
    expect(questionFromMistake(cash6max100bb, { ...mistake('AKo'), players: 9 })).toBeNull()
  })
})

describe('normalizeMistakes', () => {
  it('形の崩れた保存データは捨てる', () => {
    expect(normalizeMistakes([mistake('AKo'), { hand: 'x' }, null])).toHaveLength(1)
    expect(normalizeMistakes('broken')).toEqual([])
  })
})
