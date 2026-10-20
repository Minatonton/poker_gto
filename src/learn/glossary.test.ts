import { describe, expect, it } from 'vitest'
import { GLOSSARY_PATTERN } from './glossary'

const termsIn = (text: string) => text.split(GLOSSARY_PATTERN).filter((_, i) => i % 2 === 1)

describe('GLOSSARY_PATTERN', () => {
  it('文の中の用語を取り出す', () => {
    expect(termsIn('CO のレイズを受けて、EQ は 40%')).toEqual(['CO', 'EQ'])
  })

  it('長い用語を、その一部の短い用語より先に見つける', () => {
    expect(termsIn('EQR が低い')).toEqual(['EQR'])
    expect(termsIn('UTG+1 から')).toEqual(['UTG+1'])
  })

  it('額の bb はポジションの BB と取り違えない', () => {
    expect(termsIn('2.5bb を払う')).toEqual([])
  })
})
